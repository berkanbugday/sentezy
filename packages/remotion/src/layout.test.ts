import assert from "node:assert";
import { captionBox, captionBoxWidth } from "./layout";

const W = 1080;
const H = 1920;

/** The box is anchored by `top: N%` + translateY(-50%), so N is the block's vertical centre. */
function centrePct(position: "top" | "bottom"): number {
  const box = captionBox({ width: W, height: H, position });
  return Number(String(box.top).replace("%", ""));
}

// "Üst" and "Alt" must land in genuinely different bands — the bug was 26% vs 40%.
const top = centrePct("top");
const bottom = centrePct("bottom");
assert.ok(top <= 25, `top band sits too low: ${top}%`);
assert.ok(bottom >= 70, `bottom band sits too high: ${bottom}%`);
assert.ok(bottom - top >= 45, `top and bottom barely differ: ${bottom - top}%`);

// The block never leaves the frame once translateY(-50%) has centred it.
for (const pos of ["top", "bottom"] as const) {
  const c = centrePct(pos);
  assert.ok(c > 5 && c < 95, `caption centre ${c}% is outside the frame (${pos})`);
}

// Captions stay full width — the frame minus both 6% edge insets (deliberate design).
assert.strictEqual(captionBoxWidth({ width: W }), W - 2 * W * 0.06);

// Horizontal insets are symmetric.
const box = captionBox({ width: W, height: H, position: "bottom" });
assert.strictEqual(box.left, box.right);
assert.strictEqual(box.position, "absolute");

console.log("packages/remotion/src/layout.test.ts ok");
