import { CAPTION_STYLE_META, type CaptionStyleId } from "@sentezy/types";

// A large catalog of caption "presets" generated over the 20 canonical caption effects:
// every preset is a (effect × font × accent-colour) combination that maps straight to
// the already-plumbed {captionStyle, captionFont, captionColor}. Fonts are limited to
// the set the worker bundles + the web loads (apps/worker/fonts, layout.tsx) so a tile
// previews in the exact font the renderer uses.

export type CaptionPreset = {
  id: string;
  name: string;
  base: CaptionStyleId;
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

// The 20 caption effects, derived from the canonical registry in @sentezy/types.
// accent=false families ignore colour (clean/boxed/typewriter/rainbow) → generated white-only.
export const CAPTION_FAMILIES: { key: CaptionStyleId; label: string; accent: boolean }[] =
  CAPTION_STYLE_META.map((s) => ({ key: s.id, label: s.label, accent: s.accent }));

// Plain (non-locale) lowercase: inputs are always ASCII font names or hex colors, and the
// Turkish locale's I→ı (dotless) case-folding would corrupt "Inter" into "nter" once the
// regex below strips the resulting non-ASCII ı.
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

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

/** Rebuild a preset id from the {style, font, color} an existing video stored in
 *  options.captions. Ids are deterministic (see build() above), so this recovers the exact
 *  preset for any video ever created — no extra field needed. Unknown input → the default. */
export function presetIdFor(base: string, font: string, color: string): string {
  const fam = CAPTION_FAMILIES.find((f) => f.key === base);
  if (!fam) return DEFAULT_PRESET_ID;
  const id = fam.accent ? `${base}-${slug(font)}-${slug(color)}` : `${base}-${slug(font)}`;
  return CAPTION_PRESETS.some((p) => p.id === id) ? id : DEFAULT_PRESET_ID;
}
