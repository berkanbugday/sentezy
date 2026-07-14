import type { CaptionEngine } from "../components/CaptionSample";

// A large catalog of caption "presets" generated over the worker's caption engine:
// every preset is a (family × font × accent-colour) combination that maps straight to
// the already-plumbed {captionStyle, captionFont, captionColor}. Fonts are limited to
// the set the worker bundles + the web loads (apps/worker/fonts, layout.tsx) so a tile
// previews in the exact font the worker burns in.

export type CaptionPreset = {
  id: string;
  name: string;
  base: CaptionEngine;
  font: string;
  color: string;
  family: string; // grouping label (Turkish), used by the Filtrele sheet
};

// The 13 fonts the worker bundles and layout.tsx loads as web fonts.
export const CAPTION_FONTS = [
  "General Sans", "Anton", "Archivo Black", "Bebas Neue", "Fredoka",
  "Inter", "Kanit", "Montserrat", "Oswald", "Poppins", "Rubik", "Sora", "Teko",
];

export const CAPTION_COLORS: { name: string; hex: string }[] = [
  { name: "Sarı", hex: "#FFD54A" }, { name: "Beyaz", hex: "#FFFFFF" }, { name: "Yeşil", hex: "#34D399" },
  { name: "Mavi", hex: "#38BDF8" }, { name: "Mor", hex: "#A78BFA" }, { name: "Pembe", hex: "#F472B6" },
  { name: "Kırmızı", hex: "#F87171" }, { name: "Turuncu", hex: "#FB923C" }, { name: "Lime", hex: "#A3E635" },
  { name: "Turkuaz", hex: "#22D3EE" }, { name: "Altın", hex: "#FBBF24" }, { name: "Menekşe", hex: "#C084FC" },
];

// accent=false families ignore colour (clean/typewriter) → generated white-only.
export const CAPTION_FAMILIES: { key: CaptionEngine; label: string; accent: boolean }[] = [
  { key: "karaoke", label: "Karaoke", accent: true },
  { key: "tiktok", label: "TikTok", accent: true },
  { key: "beast", label: "Beast", accent: true },
  { key: "hormozi", label: "Hormozi", accent: true },
  { key: "boxed", label: "Kutu", accent: false },
  { key: "keyword", label: "Anahtar", accent: true },
  { key: "bubble", label: "Baloncuk", accent: true },
  { key: "highlight", label: "Vurgu", accent: true },
  { key: "clean", label: "Sade", accent: false },
  { key: "typewriter", label: "Daktilo", accent: false },
];

const slug = (s: string) => s.toLocaleLowerCase("tr").replace(/[^a-z0-9]+/g, "");

function build(): CaptionPreset[] {
  const out: CaptionPreset[] = [];
  for (const fam of CAPTION_FAMILIES) {
    for (const font of CAPTION_FONTS) {
      if (fam.accent) {
        for (const c of CAPTION_COLORS) {
          out.push({
            id: `${fam.key}-${slug(font)}-${slug(c.hex)}`,
            name: `${fam.label} · ${font} · ${c.name}`,
            base: fam.key, font, color: c.hex, family: fam.label,
          });
        }
      } else {
        out.push({
          id: `${fam.key}-${slug(font)}`,
          name: `${fam.label} · ${font}`,
          base: fam.key, font, color: "#FFFFFF", family: fam.label,
        });
      }
    }
  }
  return out;
}

export const CAPTION_PRESETS = build();

// Default preset shown pre-selected in the composer: Vurgu (highlight) / Poppins / yellow.
export const DEFAULT_PRESET =
  CAPTION_PRESETS.find((p) => p.base === "highlight" && p.font === "Poppins" && p.color === "#FFD54A") ?? CAPTION_PRESETS[0];
export const DEFAULT_PRESET_ID = DEFAULT_PRESET.id;

export function presetById(id: string): CaptionPreset {
  return CAPTION_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}
