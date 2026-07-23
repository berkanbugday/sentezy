/** The 12 marquee tiles. Each is an honest composite of what the product outputs: a real
 *  rendered avatar cutout over a sector-tinted 9:16 backdrop, with a real caption style
 *  drawn in CSS. `slug` maps to /avatars/<slug>.png, exported by
 *  apps/api/scripts/export-avatar-stills.ts. `tint` indexes .tile-<tint> in global.css. */
export type Still = {
  slug: string;
  tint: "cool" | "warm" | "rose" | "teal" | "violet" | "amber";
  sector: string;
  caption: string;
  /** Caption treatment. Mirrors real CAPTION_STYLE_META ids. */
  style: "hormozi" | "tiktok" | "highlight" | "boxed" | "glow" | "clean";
};

export const stills: Still[] = [
  { slug: "kevser",   tint: "rose",   sector: "E-commerce",   caption: "SOLD OUT TWICE", style: "hormozi" },
  { slug: "anna",     tint: "cool",   sector: "Real Estate",       caption: "3+1 SEA VIEW", style: "boxed" },
  { slug: "aaliyah",  tint: "violet", sector: "Influencer",  caption: "LINK IN BIO",      style: "glow" },
  { slug: "mariam",   tint: "teal",   sector: "Dental",         caption: "SAME DAY SMILE",   style: "highlight" },
  { slug: "beyza",    tint: "warm",   sector: "E-commerce",   caption: "NEW DROP",       style: "tiktok" },
  { slug: "hana",     tint: "cool",   sector: "Finance",      caption: "0% FOR 12 MO",     style: "boxed" },
  { slug: "sumeyye",  tint: "teal",   sector: "Health",      caption: "BOOK IN 30 SEC", style: "highlight" },
  { slug: "camila",   tint: "amber",  sector: "Automotive",    caption: "TEST DRIVE IT",      style: "hormozi" },
  { slug: "arda",     tint: "teal",   sector: "Pharmacy",      caption: "OPEN 24/7",        style: "clean" },
  { slug: "amara",    tint: "violet", sector: "Education",      caption: "ENROLL TODAY",   style: "tiktok" },
  { slug: "alp",      tint: "cool",   sector: "Optics",       caption: "2ND PAIR FREE", style: "glow" },
  { slug: "aisha",    tint: "warm",   sector: "Automotive",    caption: "0 KM, 0 STRESS",    style: "boxed" },
];

/** Two counter-scrolling columns. Split rather than interleaved so each column has a
 *  visible mix of tints. */
export const columnA = stills.filter((_, i) => i % 2 === 0);
export const columnB = stills.filter((_, i) => i % 2 === 1);
