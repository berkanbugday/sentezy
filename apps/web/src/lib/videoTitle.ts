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
 * product link (stored in `options.product.title`), else the cleaned stored title. `options`
 * isn't in the ApiVideo type but is present on the row at runtime — read it defensively.
 * No character slicing — the full title is returned (the detail heading wraps it).
 */
export function videoDisplayTitle(video: { title: string; options?: unknown }): string {
  const product = (video.options as { product?: { title?: string } } | undefined)?.product;
  const name = product?.title?.trim();
  if (name) return name;
  return cleanTitleText(video.title);
}
