import assert from "node:assert";
import { formatDuration } from "./duration";

// Nothing to show → an empty slot, never a placeholder or an invented value.
assert.strictEqual(formatDuration(null), "");
assert.strictEqual(formatDuration(undefined), "");
assert.strictEqual(formatDuration(0), "");

// Sub-minute durations keep a leading zero minute.
assert.strictEqual(formatDuration(28.4), "0:28");
assert.strictEqual(formatDuration(9), "0:09");

// Minutes unpadded, seconds padded to two digits.
assert.strictEqual(formatDuration(65), "1:05");
assert.strictEqual(formatDuration(600), "10:00");

// Rounds to the nearest second, carrying into the minute.
assert.strictEqual(formatDuration(59.6), "1:00");

// videos.duration_s is a Prisma Decimal and can arrive as a string over JSON.
assert.strictEqual(formatDuration("28.4" as unknown as number), "0:28");

// Rounds down to zero seconds, so nothing to show.
assert.strictEqual(formatDuration(0.4), "");

// Rounds up to a real second.
assert.strictEqual(formatDuration(0.6), "0:01");

// A negative duration is meaningless.
assert.strictEqual(formatDuration(-5), "");

console.log("apps/web/src/lib/duration.test.ts ok");
