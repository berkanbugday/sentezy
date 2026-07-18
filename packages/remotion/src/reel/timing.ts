export type BrollClipWindow = { fromFrame: number; durationInFrames: number };
export type BrollLayout = {
  hookFrames: number;
  closeFrames: number;
  midFromFrame: number;
  midDurationFrames: number;
  clips: BrollClipWindow[];
};

/**
 * Absolute frame windows for the reel's B-roll: a short avatar-only hook, evenly-spaced
 * cutaways filling the middle, an avatar-only CTA close. MUST mirror the worker's
 * `_broll_segments` proportions so preview and render place clips the same way.
 */
export function brollSegments(
  words: { start: number; end: number }[],
  clipCount: number,
  fps: number,
): BrollLayout {
  const empty: BrollLayout = { hookFrames: 0, closeFrames: 0, midFromFrame: 0, midDurationFrames: 0, clips: [] };
  if (clipCount <= 0 || words.length === 0) return empty;
  const t0 = words[0]!.start;
  const t1 = words[words.length - 1]!.end;
  const total = t1 - t0;
  if (total <= 0.1) return empty;

  let hook = Math.min(1.6, total * 0.22);
  const close = Math.min(1.4, total * 0.18);
  let midStart = t0 + hook;
  let midEnd = t1 - close;
  let hasClose = true;
  if (midEnd - midStart < 0.6) {
    hook = Math.min(0.5, total * 0.15);
    midStart = t0 + hook;
    midEnd = t1;
    hasClose = false;
  }
  const span = (midEnd - midStart) / clipCount;
  const sec = (s: number) => Math.round((s - t0) * fps); // relative to composition start
  const clips: BrollClipWindow[] = [];
  for (let i = 0; i < clipCount; i++) {
    const s = midStart + i * span;
    const e = i < clipCount - 1 ? midStart + (i + 1) * span : midEnd;
    clips.push({ fromFrame: sec(s), durationInFrames: Math.max(1, sec(e) - sec(s)) });
  }
  return {
    hookFrames: Math.round(hook * fps),
    closeFrames: hasClose ? Math.round(close * fps) : 0,
    midFromFrame: sec(midStart),
    midDurationFrames: sec(midEnd) - sec(midStart),
    clips,
  };
}
