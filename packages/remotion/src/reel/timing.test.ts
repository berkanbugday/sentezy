import assert from "node:assert";
import { brollSegments } from "./timing";

// 5s of words @30fps, 2 clips → hook=1.1s (min(1.6, 5*0.22)), close=0.9s (min(1.4,5*0.18)),
// mid=[1.1,4.1]=3.0s split into 2 → clip0 [1.1,2.6], clip1 [2.6,4.1].
const words = [{ start: 0, end: 0.5 }, { start: 4.5, end: 5.0 }];
const r = brollSegments(words, 2, 30);
assert.strictEqual(r.hookFrames, Math.round(1.1 * 30));
assert.strictEqual(r.closeFrames, Math.round(0.9 * 30));
assert.strictEqual(r.clips.length, 2);
assert.strictEqual(r.clips[0]!.fromFrame, Math.round(1.1 * 30));
assert.strictEqual(r.clips[0]!.durationInFrames, Math.round(1.5 * 30));
assert.strictEqual(r.clips[1]!.fromFrame, Math.round(2.6 * 30));

// no media → no clips
assert.strictEqual(brollSegments(words, 0, 30).clips.length, 0);
// empty words → no clips
assert.strictEqual(brollSegments([], 3, 30).clips.length, 0);

// non-zero t0 (leading silence) → positions MUST be absolute, not re-zeroed to words[0].start
const w2 = [{ start: 1.5, end: 2.0 }, { start: 5.5, end: 6.0 }];
const r2 = brollSegments(w2, 2, 30);
assert.strictEqual(r2.clips[0]!.fromFrame, 75);   // round(2.49*30) — NOT round(0.99*30)=30
assert.strictEqual(r2.midFromFrame, 75);
assert.strictEqual(r2.clips[1]!.fromFrame, 115);  // round(3.84*30)
assert.strictEqual(r2.hookFrames, 30);           // round(0.99*30)
assert.strictEqual(r2.closeFrames, 24);          // round(0.81*30)

// mid span < 0.6s → fallback: reduced hook, NO close
const w3 = [{ start: 0, end: 0.2 }, { start: 0.7, end: 0.9 }];
const r3 = brollSegments(w3, 1, 30);
assert.strictEqual(r3.closeFrames, 0);           // close dropped in fallback
assert.strictEqual(r3.hookFrames, 4);            // round(min(0.5,0.9*0.15)=0.135 *30)
assert.strictEqual(r3.clips[0]!.fromFrame, 4);    // round(0.135*30)

// total <= 0.1s → empty
assert.strictEqual(brollSegments([{ start: 0, end: 0.05 }], 2, 30).clips.length, 0);

console.log("timing ok");
