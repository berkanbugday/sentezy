// packages/remotion/src/brand/crop.ts
import type { CSSProperties } from "react";

/** How an upload is framed inside the 9:16 reel. Mirrors BrandCrop in @sentezy/types. */
export type BrandCrop = { x: number; y: number; scale: number };

export const DEFAULT_CROP: BrandCrop = { x: 0.5, y: 0.5, scale: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Normalise possibly-missing or out-of-range stored values. Clamps rather than throws:
 *  a bad crop should frame the media oddly, never fail a render that is otherwise fine. */
export function normalizeCrop(crop: Partial<BrandCrop> | null | undefined): BrandCrop {
  if (!crop) return DEFAULT_CROP;
  return {
    x: Number.isFinite(crop.x) ? clamp(crop.x as number, 0, 1) : 0.5,
    y: Number.isFinite(crop.y) ? clamp(crop.y as number, 0, 1) : 0.5,
    // Zoom below 1 would shrink the media inside the frame and expose bars at the edges —
    // the letterboxing this framing exists to prevent.
    scale: Number.isFinite(crop.scale) ? clamp(crop.scale as number, 1, 4) : 1,
  };
}

/**
 * The style that frames an upload. THE single definition — the composition and the web
 * preview both call this, so what the user drags is exactly what renders.
 *
 * `objectFit: cover` + `objectPosition` is what lets this work without knowing the media's
 * pixel dimensions: the browser clamps panning to whatever overflow the source actually
 * has, so a barely-wide image simply pans less than a very wide one, with no maths here.
 * `scale` then zooms in about that same focal point.
 */
export function cropStyle(crop: Partial<BrandCrop> | null | undefined): CSSProperties {
  const c = normalizeCrop(crop);
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${c.x * 100}% ${c.y * 100}%`,
    transform: c.scale === 1 ? undefined : `scale(${c.scale})`,
    // Zoom about the focal point, not the centre, so zooming in keeps the chosen subject
    // in view instead of drifting away from it.
    transformOrigin: `${c.x * 100}% ${c.y * 100}%`,
  };
}
