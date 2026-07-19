/**
 * Human-readable video titles for the library + detail screens. Historically the title was
 * `script.split("\n")[0].slice(0,80)`, which cut mid-word ("…Kare burun t"). These helpers
 * produce a clean title and also work at DISPLAY time so already-stored ugly titles read well.
 */

/** The first sentence of a title (avoids the old mid-word cut). NOT length-sliced — callers
 *  that need to fit a small space clamp with CSS; the detail heading shows it in full. */
export function cleanTitleText(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "Video";
  return t.split(/(?<=[.!?])\s+/)[0]?.trim() || t;
}

/**
 * The title to SHOW for a video: the imported product's name when the reel was seeded from a
 * product link (stored in `options.product.title`), else the cleaned stored title. An explicit
 * user rename (PATCH /videos/:id/title) sets `options.titleOverridden`, which wins over the
 * product title from then on — otherwise a rename would appear to do nothing.
 * No character slicing — the full title is returned (the detail heading wraps it).
 */
export function videoDisplayTitle(video: { title: string; options?: Record<string, unknown> | null }): string {
  if (video.options?.titleOverridden === true) return video.title;
  const product = video.options?.product as { title?: string } | undefined;
  const name = product?.title?.trim();
  if (name) return name;
  return cleanTitleText(video.title);
}
