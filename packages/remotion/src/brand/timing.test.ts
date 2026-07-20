import assert from "node:assert";
import { CARD_INTRO_FRAMES, CARD_OUTRO_FRAMES, reelSegments } from "./timing";
import type { ReelBrand } from "./types";

const FPS = 30;
const words = [
  { start: 0, end: 0.5 },
  { start: 4.5, end: 5.0 },
];

/** Today's rule, reproduced verbatim from the Root.tsx `durationFromWords` this replaces.
 *  Every no-brand case below must still equal this or existing videos change length. */
const legacyDuration = (w: { end: number }[], fps: number) =>
  Math.max(1, Math.ceil(((w.length > 0 ? w[w.length - 1]!.end : 5) + 0.3) * fps));

const BASE: ReelBrand = {
  intro: null,
  outro: null,
  watermark: false,
  logoUrl: null,
  brandName: "Sentezy",
  handle: "@sentezy",
  cta: "Hemen dene",
  color: "#0A0A0B",
  font: "General Sans",
};

// ── No brand at all: byte-for-byte the old behaviour ────────────────────────
const none = reelSegments(words, null, FPS);
assert.strictEqual(none.introFrames, 0);
assert.strictEqual(none.outroFrames, 0);
assert.strictEqual(none.bodyFrames, legacyDuration(words, FPS));
assert.strictEqual(none.totalFrames, legacyDuration(words, FPS));

// A brand object with both ends off is the same as no brand — the watermark does not
// change timing, so enabling it alone must not move a single frame.
const offOnly = reelSegments(words, { ...BASE, watermark: true }, FPS);
assert.deepStrictEqual(offOnly, none);

// ── Generated cards ─────────────────────────────────────────────────────────
const cards = reelSegments(words, { ...BASE, intro: { kind: "card" }, outro: { kind: "card" } }, FPS);
assert.strictEqual(cards.introFrames, CARD_INTRO_FRAMES);
assert.strictEqual(cards.outroFrames, CARD_OUTRO_FRAMES);
// The body is untouched by the ends — captions and B-roll are timed against it.
assert.strictEqual(cards.bodyFrames, none.bodyFrames);
assert.strictEqual(cards.totalFrames, CARD_INTRO_FRAMES + none.bodyFrames + CARD_OUTRO_FRAMES);

// Ends are independent.
const introOnly = reelSegments(words, { ...BASE, intro: { kind: "card" } }, FPS);
assert.strictEqual(introOnly.introFrames, CARD_INTRO_FRAMES);
assert.strictEqual(introOnly.outroFrames, 0);
assert.strictEqual(introOnly.totalFrames, CARD_INTRO_FRAMES + none.bodyFrames);

const outroOnly = reelSegments(words, { ...BASE, outro: { kind: "card" } }, FPS);
assert.strictEqual(outroOnly.introFrames, 0);
assert.strictEqual(outroOnly.outroFrames, CARD_OUTRO_FRAMES);

// ── An uploaded clip overrides the card duration ────────────────────────────
const clip = reelSegments(
  words,
  {
    ...BASE,
    intro: { kind: "clip", url: "https://r2/intro.mp4", durationInFrames: 72 },
    outro: { kind: "card" },
  },
  FPS,
);
assert.strictEqual(clip.introFrames, 72);
assert.strictEqual(clip.outroFrames, CARD_OUTRO_FRAMES);
assert.strictEqual(clip.totalFrames, 72 + none.bodyFrames + CARD_OUTRO_FRAMES);

// ── Edge cases ──────────────────────────────────────────────────────────────
// Empty words keep the legacy 5s fallback, and the ends still apply.
const empty = reelSegments([], { ...BASE, intro: { kind: "card" } }, FPS);
assert.strictEqual(empty.bodyFrames, legacyDuration([], FPS));
assert.strictEqual(empty.totalFrames, CARD_INTRO_FRAMES + legacyDuration([], FPS));

// A non-30 fps composition scales the cards; a clip's frames are already fps-resolved
// by the caller and must be used as given.
const at60 = reelSegments(words, { ...BASE, intro: { kind: "card" } }, 60);
assert.strictEqual(at60.introFrames, Math.round(1.5 * 60));
assert.strictEqual(at60.bodyFrames, legacyDuration(words, 60));

// Every segment must be a positive integer — Remotion rejects fractional or zero
// durationInFrames on a <Sequence>, which would fail the render, not just look wrong.
for (const seg of [none, cards, clip, empty, at60]) {
  for (const v of [seg.introFrames, seg.outroFrames, seg.bodyFrames, seg.totalFrames]) {
    assert.ok(Number.isInteger(v), `${v} must be an integer`);
    assert.ok(v >= 0, `${v} must not be negative`);
  }
  assert.ok(seg.bodyFrames > 0);
  assert.strictEqual(seg.totalFrames, seg.introFrames + seg.bodyFrames + seg.outroFrames);
}

console.log("packages/remotion/src/brand/timing.test.ts ok");
