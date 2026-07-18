import { SFX_META, SfxCue, type SfxId, tokenizeScript } from "@sentezy/types";
import { env } from "../env";

const VALID_IDS = new Set<string>(SFX_META.map((s) => s.id));
const MAX_CUES = 12;

/** True when the endpoint can run (an OpenRouter key is configured). */
export function sfxEnabled(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(key: string, model: string, messages: unknown): Promise<string | null> {
  for (const wait of [0, 1500]) {
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
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      continue;
    }
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    return (json?.choices?.[0]?.message?.content ?? "").trim();
  }
  return null;
}

const SYSTEM = `You place short sound effects into a Turkish short-video script.
You are given the script split into NUMBERED WORDS and a PALETTE of allowed sound effects.
Return ONLY JSON: {"cues":[{"sfxId":"<palette id>","wordIndex":<int>,"gain":0.7}]}.
RULES:
1. Use ONLY sfxId values from the palette. Anchor each cue to the wordIndex where the sound should hit.
2. Be sparing: about 3 to 8 cues total for a normal script; fewer is fine. Never more than ${MAX_CUES}.
3. Match meaning: price/indirim -> cash, success/win -> applause, big reveal -> boom, scene change -> whoosh, etc.
4. gain is 0..1 (default 0.7; louder hits up to ~0.85, subtle ones ~0.5).
5. Do not place two cues on the same word. Output nothing but the JSON object.`;

/** Ask the free model to place SFX. Returns validated cues; [] on any failure. */
export async function suggestSfxCues(script: string): Promise<SfxCue[]> {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return [];
  const tokens = tokenizeScript(script);
  if (tokens.length === 0) return [];

  const palette = SFX_META.map((s) => `${s.id} (${s.tags.join(", ")})`).join("\n");
  const numbered = tokens.map((t, i) => `${i}:${t}`).join(" ");
  const user = `PALETTE:\n${palette}\n\nWORDS (index:word):\n${numbered}`;
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];

  for (const model of env.OPENROUTER_SFX_MODEL.split(",").map((m) => m.trim()).filter(Boolean)) {
    const raw = await callModel(key, model, messages);
    if (!raw) continue;
    const cues = parseCues(raw, tokens.length);
    if (cues.length > 0) return cues;
  }
  return [];
}

/** Parse + hard-validate model JSON into safe cues (drop anything invalid). */
export function parseCues(raw: string, tokenCount: number): SfxCue[] {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    // tolerate code fences / stray prose around the JSON
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const arr = (obj as { cues?: unknown })?.cues;
  if (!Array.isArray(arr)) return [];
  const seen = new Set<number>();
  const out: SfxCue[] = [];
  for (const item of arr) {
    const parsed = SfxCue.safeParse(item);
    if (!parsed.success) continue;
    const { sfxId, wordIndex } = parsed.data;
    if (!VALID_IDS.has(sfxId as SfxId)) continue;
    if (wordIndex < 0 || wordIndex >= tokenCount) continue;
    if (seen.has(wordIndex)) continue;
    seen.add(wordIndex);
    out.push(parsed.data);
    if (out.length >= MAX_CUES) break;
  }
  return out;
}
