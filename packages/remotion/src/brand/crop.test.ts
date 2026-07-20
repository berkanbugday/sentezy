import assert from "node:assert";
import { DEFAULT_CROP, cropStyle, normalizeCrop } from "./crop";

// ── normalizeCrop ───────────────────────────────────────────────────────────
assert.deepStrictEqual(normalizeCrop(null), DEFAULT_CROP);
assert.deepStrictEqual(normalizeCrop(undefined), DEFAULT_CROP);
assert.deepStrictEqual(normalizeCrop({}), DEFAULT_CROP);
assert.deepStrictEqual(normalizeCrop({ x: 0.2, y: 0.8, scale: 2 }), { x: 0.2, y: 0.8, scale: 2 });

// Out-of-range values are CLAMPED, never thrown: a stored crop that somehow went bad
// should frame the media oddly, not fail an otherwise good render.
assert.deepStrictEqual(normalizeCrop({ x: -3, y: 9, scale: 100 }), { x: 0, y: 1, scale: 4 });
// Zoom never drops below 1 — under 1 shrinks the media and exposes edge bars, the exact
// letterboxing this framing exists to prevent.
assert.strictEqual(normalizeCrop({ scale: 0.2 }).scale, 1);
// NaN/Infinity fall back per-field rather than poisoning the whole crop.
assert.deepStrictEqual(normalizeCrop({ x: NaN, y: 0.3, scale: Infinity }), { x: 0.5, y: 0.3, scale: 1 });

// ── cropStyle ───────────────────────────────────────────────────────────────
const centred = cropStyle(null);
assert.strictEqual(centred.objectFit, "cover", "uploads always fill the 9:16 frame");
assert.strictEqual(centred.objectPosition, "50% 50%");
// No transform at all when unzoomed — avoids creating a compositing layer for nothing.
assert.strictEqual(centred.transform, undefined);

const panned = cropStyle({ x: 0.25, y: 0.75, scale: 1.5 });
assert.strictEqual(panned.objectPosition, "25% 75%");
assert.strictEqual(panned.transform, "scale(1.5)");
// Zoom is anchored to the focal point, so zooming in keeps the chosen subject in frame
// instead of drifting toward the centre.
assert.strictEqual(panned.transformOrigin, "25% 75%");

console.log("packages/remotion/src/brand/crop.test.ts ok");
