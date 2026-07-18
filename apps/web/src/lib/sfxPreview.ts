import { staticFile } from "remotion";
import type { PreviewBrollItem, ResolvedSfxCue } from "@sentezy/remotion";
import { brollSfxStem, type SfxCue, tokenizeScript } from "@sentezy/types";

const PER_WORD = 0.42; // MUST match captionPreview.ts estimated timing

/** Public URL for a bundled AI SFX id (served from apps/web/public/sfx). */
export function sfxSrc(id: string): string {
  return staticFile(`sfx/${id}.mp3`);
}

/** Public URL for a slide-transition sound stem (apps/web/public/sfx/transitions). */
export function transitionSfxSrc(stem: string): string {
  return staticFile(`sfx/transitions/${stem}.wav`);
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
 * Slide-transition SFX cues, one per slide, each matched to that clip's transition
 * (BROLL_SFX_MAP) — mirrors the worker's per-slide transition sounds. Aligned to the
 * ReelPreview slideshow, where clip k's boundary is at ~k*(total/n). Gated by the
 * transition-SFX toggle; needs 2+ clips to have any transition between them.
 */
export function slideSfxCues(broll: PreviewBrollItem[], totalSeconds: number, enabled: boolean): ResolvedSfxCue[] {
  const n = broll.length;
  if (!enabled || n < 2 || totalSeconds <= 0) return [];
  const out: ResolvedSfxCue[] = [];
  for (let k = 1; k < n; k++) {
    out.push({
      src: transitionSfxSrc(brollSfxStem(broll[k]!.transition)),
      time: Math.max(0, (k * totalSeconds) / n - 0.2),
      gain: 0.5,
    });
  }
  return out;
}
