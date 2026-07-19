import { env } from "../env";

/**
 * Vision-powered emotion pass for the wizard's "add emotion" button. Given a Turkish
 * script and the B-roll photos that will play behind it, inserts ElevenLabs v3 audio
 * tags ([excited]/[warmly]/…) that match BOTH the words and the mood of the photos —
 * WITHOUT changing any spoken word (a strict word-preservation guard falls back to the
 * original script otherwise). At render, the worker strips these tags from captions and
 * feeds them to eleven_v3; it also skips its own auto-tagging when tags are already present.
 *
 * Uses OpenRouter (OpenAI-compatible) so a free vision model can drive it. Mirrors the
 * worker's text-only emotion.py, adding image input.
 */

// The v3 audio tags the model may insert (kept in sync with the worker's emotion.py).
// Sound-effect tags ([applause], [gunshot], …) are deliberately excluded: this app has its
// own cued SFX engine, and a model-invented sound would land in the voice track unanchored.
const NONVERBAL_TAGS = ["laughs", "sighs", "exhales", "whispers"]; // documented as reliable in v3
// Free-form delivery cues — v3 reads descriptive tags too, and these mirror VOICE_EMOTIONS.
const TONE_TAGS = [
  "excited", "curious", "warmly", "cheerfully", "happily", "seriously", "sincerely",
  "calmly", "sarcastic", "mischievously",
];
const ALLOWED_TAGS = [...TONE_TAGS, ...NONVERBAL_TAGS];

// Wizard emotion value → a short natural-language tone description for the prompt.
const TONE_DESC: Record<string, string> = {
  warmly: "warm, friendly and inviting",
  excited: "energetic, exciting and enthusiastic",
  cheerfully: "upbeat, cheerful and positive",
  seriously: "serious, confident and authoritative",
  sincerely: "sincere, heartfelt and genuine",
};

// Written against the ElevenLabs v3 best-practices guide: text structure is the PRIMARY
// driver of v3 delivery, tags are the secondary one, and over-tagging destabilises output.
const SYSTEM = [
  "You direct the delivery of a Turkish voiceover script for ElevenLabs v3, so it sounds",
  "expressive and human sentence by sentence. You are ALSO shown the background photos that",
  "will play behind the voiceover — read their mood, setting and energy, and let them guide",
  "which emotions you pick and where.",
  "You have exactly two levers, and v3 reads both:",
  "  A. Bracketed audio tags, placed IMMEDIATELY BEFORE the words they should colour.",
  "  B. Pacing punctuation — an ellipsis '…' creates a pause or a beat of hesitation, and",
  "     . ! ? set each sentence's energy.",
  "STRICT RULES:",
  "1. Output ONLY the annotated script text — no preamble, no explanation, no quotes.",
  "2. Never change, translate, reorder, add, or remove ANY word. Every original word must",
  "   survive, in the same order and with the SAME letter case.",
  "3. The ONLY edits allowed are inserting [tags] and adjusting sentence punctuation",
  "   (. ! ? …). Do not add or remove any other character.",
  "4. Attach an ellipsis to the end of the word before the pause ('denedim…'). NEVER leave",
  "   '…' standing alone as its own word — that breaks caption timing.",
  "5. Use tags sparingly — at most one per sentence, and fewer is better. Over-tagging makes",
  "   v3 unstable.",
  "6. Only use tags from this set: {tags}. Never invent sound-effect tags.",
  "7. A tag must suit the voice and the moment — a calm read will not suddenly shout, and a",
  "   sales line should not laugh mid-pitch.",
  "8. Match the emotional arc to BOTH the requested overall tone and the mood of the photos.",
].join("\n");

const stripTags = (text: string): string => text.replace(/\[[^\]]*\]/g, " ");
const hasTag = (text: string): boolean => /\[[a-zA-Z]/.test(text);

/** The invariant an annotated script must preserve: whitespace tokens with audio tags
 *  removed and edge pacing punctuation normalised away (interior '.' — as in "3.5" — must
 *  still match). Catches paraphrase, reordering, case changes, and a stray standalone '…',
 *  which would survive as an empty token and desync caption/SFX word indices.
 *  Mirrors words_only() in apps/worker/sentezy_worker/emotion.py. */
export function wordsOnly(text: string): string[] {
  return stripTags(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/^[.!?…]+|[.!?…]+$/g, ""));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST to OpenRouter for ONE model, with a couple of retries. Free models frequently
 * return 429 ("temporarily rate-limited upstream") or transient 5xx — retry those briefly,
 * then give up so the caller can fall through to the next model. A non-429 4xx (bad
 * key/model/body) is terminal. Returns the message text, or null on give-up.
 */
async function callModel(key: string, model: string, messages: unknown): Promise<string | null> {
  const backoff = [0, 1500]; // 2 attempts per model (the model chain provides the breadth)
  for (const wait of backoff) {
    if (wait) await sleep(wait);
    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sentezy.app",
          "X-Title": "Sentezy",
        },
        body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 4000 }),
      });
    } catch {
      continue; // network error → retry
    }
    if (res.status === 429 || res.status >= 500) continue; // transient → retry
    if (!res.ok) return null; // terminal client error
    const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
    return (json?.choices?.[0]?.message?.content ?? "").trim();
  }
  return null;
}

/** True when the emotion pass is configured (an OpenRouter key is set). */
export function emotionEnabled(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

export interface EnhanceResult {
  script: string;
  changed: boolean;
}

/**
 * Return the script with v3 audio tags inserted for emotional delivery, guided by the
 * B-roll photos. Returns the original script (changed=false) on missing key, empty input,
 * any request error, or if the model altered the words (paraphrase guard).
 */
export async function enhanceScriptEmotion(
  script: string,
  imageUrls: string[],
  tone: string,
): Promise<EnhanceResult> {
  const key = env.OPENROUTER_API_KEY;
  if (!key || !script.trim()) return { script, changed: false };

  const tags = ALLOWED_TAGS.map((t) => `[${t}]`).join(", ");
  const system = SYSTEM.replace("{tags}", tags);
  const toneDesc = TONE_DESC[tone] ?? (tone || "natural, engaging and human");
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `Overall tone: ${toneDesc}\n\nScript:\n${script}` },
    ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const messages = [
    { role: "system", content: system },
    { role: "user", content },
  ];
  // Try each model in the chain (comma-separated). Different free models route to
  // different upstream providers with independent rate limits, so if one is 429-saturated
  // the next usually answers. Accept the first response that passes the word guard.
  const models = env.OPENROUTER_VISION_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
  const baseline = wordsOnly(script).join(" ");
  for (const model of models) {
    const out = await callModel(key, model, messages);
    if (!out) continue; // 429/error for this model → try the next
    // Accept only if the model (a) actually inserted at least one tag — weak models just
    // echo the script back, which must NOT count as "emotion added" — and (b) left the
    // spoken words untouched, so the TTS word alignment still lines up with captions and
    // SFX cues. Else try the next model.
    if (hasTag(out) && wordsOnly(out).join(" ") === baseline) {
      return { script: out, changed: true };
    }
  }
  return { script, changed: false };
}
