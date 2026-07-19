import assert from "node:assert";
import { captionBox, captionBoxWidth } from "./layout";

const W = 1080;
const H = 1920;
const POSITIONS = ["left", "center", "right"] as const;

/** The box is anchored by `top: N%` + translateY(-50%), so N is the block's vertical centre. */
function centrePct(avatarPosition: (typeof POSITIONS)[number], position: "top" | "bottom"): number {
  const box = captionBox({ width: W, height: H, avatarPosition, position });
  return Number(String(box.top).replace("%", ""));
}

// "Üst" and "Alt" must land in genuinely different bands — the bug was 26% vs 40%.
const top = centrePct("right", "top");
const bottom = centrePct("right", "bottom");
assert.ok(top <= 25, `top band sits too low: ${top}%`);
assert.ok(bottom >= 70, `bottom band sits too high: ${bottom}%`);
assert.ok(bottom - top >= 45, `top and bottom barely differ: ${bottom - top}%`);

// A bottom-centred avatar owns the lower frame, so "Alt" lifts above its head...
const centerBottom = centrePct("center", "bottom");
assert.ok(centerBottom < bottom, "a centre avatar must raise the bottom caption band");
// ...but stays clearly below the top band.
assert.ok(centerBottom - top >= 30, `raised bottom band too close to the top band: ${centerBottom - top}%`);

// A side avatar never changes the bands (left and right are mirror images).
assert.strictEqual(centrePct("left", "bottom"), centrePct("right", "bottom"));
// The avatar is always bottom-anchored, so "Üst" is avatar-independent.
for (const p of POSITIONS) assert.strictEqual(centrePct(p, "top"), top);

// The block never leaves the frame once translateY(-50%) has centred it.
for (const p of POSITIONS) {
  for (const pos of ["top", "bottom"] as const) {
    const c = centrePct(p, pos);
    assert.ok(c > 5 && c < 95, `caption centre ${c}% is outside the frame (${p}/${pos})`);
  }
}

// Captions stay full width — the frame minus both 6% edge insets (deliberate design).
assert.strictEqual(captionBoxWidth({ width: W }), W - 2 * W * 0.06);

// Horizontal insets are symmetric.
const box = captionBox({ width: W, height: H, avatarPosition: "right", position: "bottom" });
assert.strictEqual(box.left, box.right);
assert.strictEqual(box.position, "absolute");

console.log("packages/remotion/src/layout.test.ts ok");
