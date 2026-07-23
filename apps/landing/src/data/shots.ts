/** Which studio blocks actually have a screenshot to show.
 *
 *  The spec's rule for this section is cut-not-placeholder: a block whose app screenshot has
 *  not been captured is dropped from the page rather than shipped as a gray box. Rather than
 *  hardcode which ones exist, the shots are discovered from the filesystem at build time — so
 *  dropping `src/assets/app/composer.png` into place is the whole job, and removing it takes
 *  the block back out. If none exist, `HAS_STUDIO` is false and the whole `#platform` section
 *  and its nav/footer links disappear together, leaving no dangling anchor.
 *
 *  src/assets, never public/: astro:assets downscales these and emits WebP. A 2x 1440x900 PNG
 *  served byte-for-byte from public/ would be several MB on a marketing page — the same trap
 *  the avatar cutouts hit in Task 1.
 */
import type { ImageMetadata } from "astro";
import { studio } from "./copy";

const shots = import.meta.glob<{ default: ImageMetadata }>("../assets/app/*.png", { eager: true });

type Block = (typeof studio.blocks)[number];
export type StudioBlock = Block & { shot: ImageMetadata };

export const studioBlocks: StudioBlock[] = studio.blocks.flatMap((b) => {
  const mod = shots[`../assets/app/${b.key}.png`];
  return mod ? [{ ...b, shot: mod.default }] : [];
});

/** Nav and Footer link to `#platform` only when something renders there. */
export const HAS_STUDIO = studioBlocks.length > 0;
