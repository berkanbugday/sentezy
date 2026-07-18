import { staticFile } from "remotion";
import { brollSegments, type ReelBrollItem, type ResolvedSfxCue } from "@sentezy/remotion";
import { brollSfxStem, type SfxCue, tokenizeScript } from "@sentezy/types";
import { previewWords } from "@/lib/captionPreview";

const PER_WORD = 0.42; // MUST match captionPreview.ts estimated timing
const FPS = 30;

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
 * Slide-transition SFX cues, one per cutaway, each matched to that clip's transition
 * (BROLL_SFX_MAP) — mirrors the worker's per-slide transition sounds. Timed to the SAME
 * clip frames the Reel places (via shared brollSegments) so the preview's whooshes land
 * on the visible transitions, exactly like the worker's ffmpeg mux (clip 0 gets none,
 * each subsequent clip's whoosh leads its cut by 0.2s). Gated by the transition-SFX
 * toggle; needs 2+ clips to have any transition between them.
 */
export function slideSfxCues(broll: ReelBrollItem[], script: string, enabled: boolean): ResolvedSfxCue[] {
  if (!enabled || broll.length < 2) return [];
  const seg = brollSegments(previewWords(script), broll.length, FPS);
  const out: ResolvedSfxCue[] = [];
  for (let k = 1; k < broll.length; k++) {
    const startFrame = seg.clips[k]?.fromFrame ?? 0;
    out.push({
      src: transitionSfxSrc(brollSfxStem(broll[k]!.transition)),
      time: Math.max(0, startFrame / FPS - 0.2),
      gain: 0.2,
    });
  }
  return out;
}
