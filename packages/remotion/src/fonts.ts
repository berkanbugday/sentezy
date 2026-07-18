import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** The 13 caption fonts — the same files the worker bundles (apps/worker/fonts),
 *  copied into public/fonts. Loaded here so both the container render and the
 *  browser <Player> preview burn the identical glyphs the user picked. */
const FONTS: { family: string; file: string; weight?: string }[] = [
  { family: "General Sans", file: "GeneralSans-Semibold.otf", weight: "600" },
  { family: "Anton", file: "Anton.ttf" },
  { family: "Archivo Black", file: "ArchivoBlack.ttf" },
  { family: "Bebas Neue", file: "BebasNeue.ttf" },
  { family: "Fredoka", file: "Fredoka.ttf" },
  { family: "Inter", file: "Inter.ttf" },
  { family: "Kanit", file: "Kanit.ttf" },
  { family: "Montserrat", file: "Montserrat.ttf" },
  { family: "Oswald", file: "Oswald.ttf" },
  { family: "Poppins", file: "Poppins.ttf" },
  { family: "Rubik", file: "Rubik.ttf" },
  { family: "Sora", file: "Sora.ttf" },
  { family: "Teko", file: "Teko.ttf" },
];

export const CAPTION_FONT_FAMILIES = FONTS.map((f) => f.family);
const DEFAULT_FAMILY = "General Sans";

let started = false;
/** Kick off loading every caption font. Idempotent; safe to call from module top-level
 *  and from components. Each loadFont() registers a delayRender/continueRender internally. */
export function ensureFontsLoaded(): void {
  if (started) return;
  started = true;
  for (const f of FONTS) {
    loadFont({
      family: f.family,
      url: staticFile(`fonts/${f.file}`),
      weight: f.weight ?? "400",
    }).catch(() => {
      // A single missing font must not fail the whole render — fall back to default.
    });
  }
}

/** Resolve a requested family to one we actually loaded (else the default). */
export function resolveFamily(family: string): string {
  return CAPTION_FONT_FAMILIES.includes(family) ? family : DEFAULT_FAMILY;
}

ensureFontsLoaded();
