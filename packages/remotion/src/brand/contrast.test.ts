import assert from "node:assert";
import { readableInk } from "./contrast";

const INK = "#0a0a0b";
const PAPER = "#ffffff";

// Dark brands take white text, light brands take ink.
assert.strictEqual(readableInk("#000000"), PAPER);
assert.strictEqual(readableInk("#0A0A0B"), PAPER);
assert.strictEqual(readableInk("#FFFFFF"), INK);
assert.strictEqual(readableInk("#F4F4F5"), INK);

// The cases a naive `average of RGB` test gets wrong. Yellow and cyan are far brighter to
// the eye than their RGB average suggests, and pure blue is far darker — luminance
// weighting is what makes these come out right.
assert.strictEqual(readableInk("#FFFF00"), INK, "yellow is a light background");
assert.strictEqual(readableInk("#00FFFF"), INK, "cyan is a light background");
assert.strictEqual(readableInk("#0000FF"), PAPER, "pure blue is a dark background");
assert.strictEqual(readableInk("#FF0000"), PAPER, "pure red is a dark background");
assert.strictEqual(readableInk("#00FF00"), INK, "pure green is a light background");

// Case-insensitive and whitespace-tolerant — the value arrives from a colour input.
assert.strictEqual(readableInk("#ffff00"), INK);
assert.strictEqual(readableInk("  #FFFF00  "), INK);

// Malformed input must not throw; the card still has to render something.
assert.strictEqual(readableInk("red"), PAPER);
assert.strictEqual(readableInk("#fff"), PAPER);
assert.strictEqual(readableInk(""), PAPER);

console.log("packages/remotion/src/brand/contrast.test.ts ok");
