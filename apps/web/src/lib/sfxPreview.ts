import { staticFile } from "remotion";
import type { ResolvedSfxCue } from "@sentezy/remotion";
import { type SfxCue, tokenizeScript } from "@sentezy/types";

const PER_WORD = 0.42; // MUST match captionPreview.ts estimated timing

/** Public URL for a bundled SFX id (served from apps/web/public/sfx). */
export function sfxSrc(id: string): string {
  return staticFile(`sfx/${id}.mp3`);
}

/**
 * Resolve word-anchored cues to preview times using the SAME estimated timing the caption
 * preview uses (PER_WORD per token). Independent of captionPreview's 14-word display cap so
 * later cues still play.
 */
export function resolvePreviewSfx(script: string, cues: SfxCue[]): ResolvedSfxCue[] {
  const nTokens = tokenizeScript(script).length;
  return cues
    .filter((c) => c.wordIndex >= 0 && c.wordIndex < nTokens)
    .map((c) => ({ src: sfxSrc(c.sfxId), time: c.wordIndex * PER_WORD, gain: c.gain }));
}
