import type { CaptionPage, CaptionWord } from "./types";

/**
 * Group words into fixed-size pages (like the worker's per-chunk ASS events), converting
 * absolute-seconds timing into frames. Each page's tokens carry frames **relative to the
 * page's own Sequence start**, so an effect can read `useCurrentFrame()` in 0-based space.
 *
 * A page starts when its first word starts and ends when the next page's first word starts
 * (so the last spoken chunk lingers until the next begins), clamped to the composition end.
 */
export function buildPages(words: CaptionWord[], perChunk: number, fps: number, totalFrames: number): CaptionPage[] {
  const clean = words.filter((w) => w.text.trim().length > 0);
  const pages: CaptionPage[] = [];
  const chunk = Math.max(1, perChunk);

  for (let i = 0; i < clean.length; i += chunk) {
    const group = clean.slice(i, i + chunk);
    if (group.length === 0) continue;
    const first = group[0]!;
    const next = clean[i + chunk];

    const startFrame = Math.max(0, Math.round(first.start * fps));
    const rawEnd = next ? Math.round(next.start * fps) : Math.round(group[group.length - 1]!.end * fps);
    const endFrame = Math.min(totalFrames, Math.max(startFrame + 1, rawEnd));

    const tokens = group.map((w) => {
      const from = Math.max(0, Math.round(w.start * fps) - startFrame);
      const to = Math.max(from + 1, Math.round(w.end * fps) - startFrame);
      return { text: w.text, fromFrame: from, toFrame: to };
    });

    pages.push({ startFrame, durationInFrames: endFrame - startFrame, tokens });
  }

  return pages;
}

/** Index of the token being spoken at `frame` (page-relative); the last token once past the end. */
export function activeTokenIndex(frame: number, tokens: CaptionPage["tokens"]): number {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (frame >= tokens[i]!.fromFrame) return i;
  }
  return 0;
}
