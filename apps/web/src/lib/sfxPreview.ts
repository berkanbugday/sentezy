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

/**
 * Whoosh cues at each slide transition, so the preview plays the slide-synced SFX (matching the
 * worker's transition whooshes). Aligned to the ReelPreview slideshow, where clip k boundary is
 * at ~k*(total/n). Gated by the transition-SFX toggle; needs 2+ clips to have any transition.
 */
export function slideWhooshCues(brollCount: number, totalSeconds: number, enabled: boolean): ResolvedSfxCue[] {
  if (!enabled || brollCount < 2 || totalSeconds <= 0) return [];
  const out: ResolvedSfxCue[] = [];
  for (let k = 1; k < brollCount; k++) {
    out.push({ src: sfxSrc("whoosh"), time: Math.max(0, (k * totalSeconds) / brollCount - 0.2), gain: 0.4 });
  }
  return out;
}
