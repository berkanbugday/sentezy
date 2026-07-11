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
const ALLOWED_TAGS = [
  "excited", "warmly", "cheerfully", "happily", "seriously", "sincerely", "calmly",
  "curiously", "sadly", "nervously", "sarcastic", "whispers", "laughs", "sighs", "gasps",
];

// Wizard emotion value → a short natural-language tone description for the prompt.
const TONE_DESC: Record<string, string> = {
  warmly: "warm, friendly and inviting",
  excited: "energetic, exciting and enthusiastic",
  cheerfully: "upbeat, cheerful and positive",
  seriously: "serious, confident and authoritative",
  sincerely: "sincere, heartfelt and genuine",
};

const SYSTEM = [
  "You annotate a Turkish voiceover script with ElevenLabs v3 audio tags so the delivery",
  "sounds expressive and human, sentence by sentence. You are ALSO shown the background",
  "photos that will play behind the voiceover — read their mood, setting and energy, and let",
  "them guide which emotions you pick and where.",
  "STRICT RULES:",
  "1. Output ONLY the annotated script text — no preamble, no explanation, no quotes.",
  "2. Do NOT change, translate, reorder, add, or remove ANY of the original words.",
  "   Insert bracketed tags only. Every original word must remain, in the same order.",
  "3. Keep all original punctuation exactly.",
  "4. Use tags sparingly and naturally — about one per sentence at most; fewer is fine.",
  "5. Only use tags from this set: {tags}.",
  "6. Match the emotional arc to BOTH the requested overall tone and the mood of the photos.",
].join("\n");

const stripTags = (text: string): string => text.replace(/\[[^\]]*\]/g, " ");
const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);
const hasTag = (text: string): boolean => /\[[a-zA-Z]+\]/.test(text);
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
  for (const model of models) {
    const out = await callModel(key, model, messages);
    if (!out) continue; // 429/error for this model → try the next
    // Accept only if the model (a) actually inserted at least one tag — weak models just
    // echo the script back, which must NOT count as "emotion added" — and (b) preserved
    // every original word (no paraphrase, so TTS speaks the real script). Else try next.
    if (hasTag(out) && words(stripTags(out)).join(" ") === words(script).join(" ")) {
      return { script: out, changed: true };
    }
  }
  return { script, changed: false };
}
