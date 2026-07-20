import assert from "node:assert";
import { MAX_CLIP_MS, MIN_CLIP_MS, clipErrorMessage, readMediaDuration, validateClipDuration } from "./videoDuration";

// Normal clips round to whole milliseconds.
assert.deepStrictEqual(validateClipDuration(2.4), { ok: true, ms: 2400 });
assert.deepStrictEqual(validateClipDuration(1.2345), { ok: true, ms: 1235 });

// The values a browser actually reports when it cannot measure a stream. These MUST be
// rejected, not defaulted: the duration delays the voiceover for the whole reel, so a
// guess here desynchronises every second of the video.
assert.deepStrictEqual(validateClipDuration(NaN), { ok: false, reason: "unreadable" });
assert.deepStrictEqual(validateClipDuration(Infinity), { ok: false, reason: "unreadable" });
assert.deepStrictEqual(validateClipDuration(0), { ok: false, reason: "unreadable" });
assert.deepStrictEqual(validateClipDuration(-3), { ok: false, reason: "unreadable" });

// Bounds are inclusive at the limits and reject just outside them.
assert.strictEqual(validateClipDuration(MIN_CLIP_MS / 1000).ok, true);
assert.strictEqual(validateClipDuration(MAX_CLIP_MS / 1000).ok, true);
assert.deepStrictEqual(validateClipDuration(0.299), { ok: false, reason: "too_short" });
assert.deepStrictEqual(validateClipDuration(15.001), { ok: false, reason: "too_long" });

// A rounded value that lands exactly on a bound is accepted, not caught by an off-by-one.
assert.deepStrictEqual(validateClipDuration(0.2999), { ok: true, ms: 300 });

// Every rejection has a message that tells the user what to do about it.
for (const r of ["unreadable", "too_short", "too_long"] as const) {
  const msg = clipErrorMessage(r);
  assert.ok(msg.length > 10 && /[.!]$/.test(msg), `${r} needs a real sentence`);
}
assert.notStrictEqual(clipErrorMessage("too_short"), clipErrorMessage("too_long"));

// ── Images ──────────────────────────────────────────────────────────────────
// An image has no intrinsic duration, so it takes the card's — no DOM needed, which is
// also why this path must not fall through to the <video> measurement.
const png = { type: "image/png" } as File;
assert.deepStrictEqual(await readMediaDuration(png, 1500), { ok: true, ms: 1500 });
assert.deepStrictEqual(await readMediaDuration(png, 2000), { ok: true, ms: 2000 });

// The supplied image duration is still validated — a caller passing nonsense must not
// slip an unusable length into the reel's timing.
assert.deepStrictEqual(await readMediaDuration(png, 0), { ok: false, reason: "unreadable" });
assert.deepStrictEqual(await readMediaDuration(png, 99_000), { ok: false, reason: "too_long" });

console.log("apps/web/src/lib/videoDuration.test.ts ok");
