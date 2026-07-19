import assert from "node:assert";
import { readAvatarPosition, ReelOptions } from "./index";

// Legacy blobs (written before 2026-07-19) map forward.
assert.strictEqual(readAvatarPosition({ avatarLayout: "bottom", avatarSide: "left" }), "center");
assert.strictEqual(readAvatarPosition({ avatarLayout: "bottom", avatarSide: "right" }), "center");
assert.strictEqual(readAvatarPosition({ avatarLayout: "side", avatarSide: "left" }), "left");
assert.strictEqual(readAvatarPosition({ avatarLayout: "side", avatarSide: "right" }), "right");

// Missing / malformed input falls back to the default side.
assert.strictEqual(readAvatarPosition({}), "right");
assert.strictEqual(readAvatarPosition(undefined), "right");
assert.strictEqual(readAvatarPosition(null), "right");
assert.strictEqual(readAvatarPosition({ avatarPosition: "sideways" }), "right");

// An explicit new-shape value wins over any legacy key.
assert.strictEqual(readAvatarPosition({ avatarPosition: "center", avatarSide: "left" }), "center");
assert.strictEqual(readAvatarPosition({ avatarPosition: "left", avatarLayout: "bottom" }), "left");

// ReelOptions normalises legacy blobs AND strips the legacy keys.
const legacy = ReelOptions.parse({
  layout: { avatarLayout: "bottom", avatarSide: "left", captionPosition: "top" },
});
assert.deepStrictEqual(legacy.layout, { avatarPosition: "center", captionPosition: "top" });

// New-shape blobs round-trip untouched.
const fresh = ReelOptions.parse({ layout: { avatarPosition: "left", captionPosition: "bottom" } });
assert.deepStrictEqual(fresh.layout, { avatarPosition: "left", captionPosition: "bottom" });

// Absent layout gets the defaults.
assert.deepStrictEqual(ReelOptions.parse({}).layout, {
  avatarPosition: "right",
  captionPosition: "bottom",
});

console.log("packages/types/src/layout.test.ts ok");
