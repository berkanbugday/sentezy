import assert from "node:assert";
import { collectUserR2Keys } from "./accountKeys";

// A full account: two videos (one with B-roll media, one legacy images shape), an avatar,
// and a brand kit. Every durable key should be collected, deduped, once.
const keys = collectUserR2Keys({
  videos: [
    {
      outputKey: "videos/v1.mp4",
      thumbnailImageId: "thumbnails/v1.jpg",
      options: {
        background: {
          type: "image",
          value: "images/a.png",
          media: [
            { kind: "image", ref: "images/a.png" }, // dup of value — must collapse
            { kind: "video", ref: "broll/b.mp4" },
          ],
        },
      },
    },
    {
      outputKey: "videos/v2.mp4",
      thumbnailImageId: null,
      options: { background: { type: "image", value: "images/c.png", images: ["images/c.png", "images/d.png"] } },
    },
  ],
  avatars: [{ sourceImageId: "avatars/src.png", previewImageId: "avatars/prev.png" }],
  brandKit: { logoKey: "brand/logo.png", introClipKey: "brand/intro.mp4", outroClipKey: null },
});

const expected = [
  "videos/v1.mp4",
  "thumbnails/v1.jpg",
  "images/a.png",
  "broll/b.mp4",
  "videos/v2.mp4",
  "images/c.png",
  "images/d.png",
  "avatars/src.png",
  "avatars/prev.png",
  "brand/logo.png",
  "brand/intro.mp4",
];
assert.deepStrictEqual([...keys].sort(), [...expected].sort());
// Deduped: "images/a.png" appears as both value and media ref but only once.
assert.strictEqual(keys.filter((k) => k === "images/a.png").length, 1);

// A solid-colour background contributes no keys — `value` is a hex, not an R2 object.
assert.deepStrictEqual(
  collectUserR2Keys({
    videos: [{ outputKey: null, thumbnailImageId: null, options: { background: { type: "color", value: "#0B0B0D" } } }],
    avatars: [],
    brandKit: null,
  }),
  [],
);

// Malformed / absent options must not throw — options is opaque JSON from the DB.
for (const bad of [null, undefined, {}, { background: null }, { background: "nope" }, { background: { media: "x" } }]) {
  assert.deepStrictEqual(
    collectUserR2Keys({ videos: [{ outputKey: null, thumbnailImageId: null, options: bad }], avatars: [], brandKit: null }),
    [],
  );
}

// Empty account → empty list, never a throw.
assert.deepStrictEqual(collectUserR2Keys({ videos: [], avatars: [], brandKit: null }), []);

console.log("apps/api/src/lib/accountKeys.test.ts ok");
