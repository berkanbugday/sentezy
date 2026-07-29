/** The 12 marquee tiles. Each is an honest composite of what the product outputs: a real
 *  rendered avatar cutout over a sector-tinted 9:16 backdrop, with a real caption style
 *  drawn in CSS. `slug` maps to /avatars/<slug>.png, exported by
 *  apps/api/scripts/export-avatar-stills.ts. `tint` indexes .tile-<tint> in global.css. */
import type { StillId } from "../i18n/types";

export type Still = {
  id: StillId;
  slug: string;
  tint: "cool" | "warm" | "rose" | "teal" | "violet" | "amber";
  /** Caption treatment. Mirrors real CAPTION_STYLE_META ids. */
  style: "hormozi" | "tiktok" | "highlight" | "boxed" | "glow" | "clean";
};

/** Twelve tiles, twelve DIFFERENT avatars — and every avatar is the one apps/api's
 *  avatars.json actually assigns to that tile's sector, so the marquee shows a face genuinely
 *  styled for the business it claims.
 *
 *  The distinctness is load-bearing, not tidiness. An earlier version drew these from seven
 *  avatars, five of them used twice, and each duplicated pair happened to land in opposite
 *  columns (aisha at t3/t12, camila t1/t8, amara t5/t10, arda t4/t9, hana t6/t7). Because the
 *  two columns counter-scroll, every one of those pairs was *guaranteed* to line up
 *  side-by-side at some scroll offset — the same face twice, in adjacent tiles. Keep these
 *  twelve slugs distinct and that cannot recur; reintroduce a duplicate and it will. */
export const stills: Still[] = [
  { id: "t1",  slug: "beyza",   tint: "rose",   style: "hormozi" },   // E-commerce
  { id: "t2",  slug: "anna",    tint: "cool",   style: "boxed" },     // Real Estate
  { id: "t3",  slug: "aaliyah", tint: "violet", style: "glow" },      // Influencer
  { id: "t4",  slug: "mariam",  tint: "teal",   style: "highlight" }, // Dental
  { id: "t5",  slug: "kevser",  tint: "warm",   style: "tiktok" },    // E-commerce
  { id: "t6",  slug: "hana",    tint: "cool",   style: "boxed" },     // Finance
  { id: "t7",  slug: "sumeyye", tint: "teal",   style: "highlight" }, // Health
  { id: "t8",  slug: "camila",  tint: "amber",  style: "hormozi" },   // Automotive
  { id: "t9",  slug: "arda",    tint: "teal",   style: "clean" },     // Pharmacy
  { id: "t10", slug: "amara",   tint: "violet", style: "tiktok" },    // Education
  { id: "t11", slug: "alp",     tint: "cool",   style: "glow" },      // Optics
  { id: "t12", slug: "aisha",   tint: "warm",   style: "boxed" },     // Automotive
];

/* Enforced, not trusted. Astro evaluates this module during the static build, so a repeated
   slug fails `pnpm build` instead of shipping a marquee that shows the same face twice. */
const slugs = stills.map((s) => s.slug);
const repeated = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
if (repeated.length > 0) {
  throw new Error(
    `stills.ts: avatar slug(s) used more than once — ${repeated.join(", ")}. The two marquee ` +
      `columns counter-scroll, so a repeated slug is guaranteed to line up side-by-side at ` +
      `some offset. Give each of the 12 tiles a distinct avatar.`,
  );
}

/** Two counter-scrolling columns. Split rather than interleaved so each column has a
 *  visible mix of tints. */
export const columnA = stills.filter((_, i) => i % 2 === 0);
export const columnB = stills.filter((_, i) => i % 2 === 1);
