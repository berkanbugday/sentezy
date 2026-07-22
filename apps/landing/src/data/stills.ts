/** The 12 marquee tiles. Each is an honest composite of what the product outputs: a real
 *  rendered avatar cutout over a sector-tinted 9:16 backdrop, with a real caption style
 *  drawn in CSS. `slug` maps to /avatars/<slug>.png, exported by
 *  apps/api/scripts/export-avatar-stills.ts. `tint` indexes .tile-<tint> in global.css. */
export type Still = {
  slug: string;
  tint: "cool" | "warm" | "rose" | "teal" | "violet" | "amber";
  sector: { en: string; tr: string };
  caption: { en: string; tr: string };
  /** Caption treatment. Mirrors real CAPTION_STYLE_META ids. */
  style: "hormozi" | "tiktok" | "highlight" | "boxed" | "glow" | "clean";
};

export const stills: Still[] = [
  { slug: "kevser",   tint: "rose",   sector: { en: "E-commerce",  tr: "E-ticaret" },   caption: { en: "SOLD OUT TWICE", tr: "İKİ KEZ TÜKENDİ" }, style: "hormozi" },
  { slug: "anna",     tint: "cool",   sector: { en: "Real Estate", tr: "Emlak" },       caption: { en: "3+1 SEA VIEW",   tr: "3+1 DENİZ MANZARA" }, style: "boxed" },
  { slug: "aaliyah",  tint: "violet", sector: { en: "Influencer",  tr: "Influencer" },  caption: { en: "LINK IN BIO",    tr: "LİNK BIO'DA" },      style: "glow" },
  { slug: "mariam",   tint: "teal",   sector: { en: "Dental",      tr: "Diş" },         caption: { en: "SAME DAY SMILE", tr: "AYNI GÜN GÜLÜŞ" },   style: "highlight" },
  { slug: "beyza",    tint: "warm",   sector: { en: "E-commerce",  tr: "E-ticaret" },   caption: { en: "NEW DROP",       tr: "YENİ SEZON" },       style: "tiktok" },
  { slug: "hana",     tint: "cool",   sector: { en: "Finance",     tr: "Finans" },      caption: { en: "0% FOR 12 MO",   tr: "12 AY 0 FAİZ" },     style: "boxed" },
  { slug: "sumeyye",  tint: "teal",   sector: { en: "Health",      tr: "Sağlık" },      caption: { en: "BOOK IN 30 SEC", tr: "30 SANİYEDE RANDEVU" }, style: "highlight" },
  { slug: "camila",   tint: "amber",  sector: { en: "Automotive",  tr: "Otomotiv" },    caption: { en: "TEST DRIVE IT",  tr: "TEST SÜRÜŞÜ" },      style: "hormozi" },
  { slug: "arda",     tint: "teal",   sector: { en: "Pharmacy",    tr: "Eczane" },      caption: { en: "OPEN 24/7",      tr: "7/24 AÇIK" },        style: "clean" },
  { slug: "amara",    tint: "violet", sector: { en: "Education",   tr: "Eğitim" },      caption: { en: "ENROLL TODAY",   tr: "BUGÜN KAYIT OL" },   style: "tiktok" },
  { slug: "alp",      tint: "cool",   sector: { en: "Optics",      tr: "Optik" },       caption: { en: "2ND PAIR FREE",  tr: "2. GÖZLÜK BEDAVA" }, style: "glow" },
  { slug: "aisha",    tint: "warm",   sector: { en: "Automotive",  tr: "Otomotiv" },    caption: { en: "0 KM, 0 STRESS", tr: "0 KM, 0 STRES" },    style: "boxed" },
];

/** Two counter-scrolling columns. Split rather than interleaved so each column has a
 *  visible mix of tints. */
export const columnA = stills.filter((_, i) => i % 2 === 0);
export const columnB = stills.filter((_, i) => i % 2 === 1);
