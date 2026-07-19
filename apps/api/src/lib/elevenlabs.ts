import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "../env";

// Eleven v3 — the most expressive model (audio tags + emotional delivery) and the one the
// worker renders with, so previews sound like the final video. Keep these in sync with
// apps/worker/sentezy_worker/providers/elevenlabs.py.
export const TTS_MODEL_ID = "eleven_v3";

// v3 takes stability as one of three discrete modes (0 Creative / 0.5 Natural / 1 Robust);
// Creative is the most emotional and tag-responsive. ONLY stability and style apply to v3 —
// similarity and speaker boost are not available for this model, and the docs recommend
// keeping style at 0 at all times.
export const TTS_VOICE_SETTINGS = { stability: 0, style: 0 };

// v3 is documented as inconsistent on very short inputs (>250 characters is the recommended
// floor), and it reads text structure — so a preview should end on a sentence, not mid-word.
export const PREVIEW_MAX_CHARS = 500;

/** Trim to at most `max` characters, preferring the last sentence boundary so v3 gets a
 *  well-formed chunk. Falls back to a hard cut when there is no boundary to land on. */
export function trimToSentence(text: string, max = PREVIEW_MAX_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastEnd = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"), cut.lastIndexOf("…"));
  // Only honour a boundary that isn't so early it guts the preview.
  return (lastEnd > max * 0.4 ? cut.slice(0, lastEnd + 1) : cut).trim();
}

/** Prefix a v3 emotion tag ("excited", "warmly", …) unless the script is already annotated
 *  — the emotion pass's per-sentence tags must win over a blanket leading tag. */
export function applyEmotionTag(text: string, emotion?: string): string {
  const tone = (emotion ?? "").trim();
  if (!tone || /\[[a-zA-Z]/.test(text)) return text;
  return `[${tone}] ${text}`;
}

// The key is optional (voice features degrade gracefully without it), so build the client
// lazily and memoise it — callers guard on env.ELEVENLABS_API_KEY before calling.
let client: ElevenLabsClient | null = null;

export function elevenlabs(): ElevenLabsClient {
  if (!env.ELEVENLABS_API_KEY) throw new Error("tts_unavailable");
  if (!client) client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
  return client;
}

/** Drain the SDK's audio stream into a single Buffer. */
export async function collectAudio(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}
