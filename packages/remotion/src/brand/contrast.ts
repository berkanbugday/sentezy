// packages/remotion/src/brand/contrast.ts

/**
 * Pick a readable text colour for a user-chosen background, via WCAG relative luminance.
 *
 * The brand colour can be anything from near-black to bright yellow, so the card's text
 * colour has to be derived rather than fixed — hardcoded white vanishes on a pale brand.
 * Kept free of Remotion imports so it can be unit-tested on its own.
 */
export function readableInk(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  // Not a colour we can reason about — white is the safer default, since the card only
  // ever falls back here for malformed input that zod should already have rejected.
  if (!m) return "#ffffff";
  const n = parseInt(m[1]!, 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
  // 0.45 rather than the usual 0.5: at the midpoint dark text wins on more brand hues.
  return lum > 0.45 ? "#0a0a0b" : "#ffffff";
}
