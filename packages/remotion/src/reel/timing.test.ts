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

console.log("timing ok");
