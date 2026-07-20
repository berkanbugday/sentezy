import assert from "node:assert";
import { BrandSnapshot, ReelOptions } from "./index";

// ── Defaults ────────────────────────────────────────────────────────────────
// A video with no branding at all must come out with everything off and no kit.
// This is the case for every video created before the feature existed.
assert.deepStrictEqual(ReelOptions.parse({}).branding, {
  intro: false,
  outro: false,
  watermark: false,
  kit: null,
  logoImageId: null,
});

// ── BACK-COMPAT: the vestigial shape ────────────────────────────────────────
// `branding` shipped as a placeholder with logoImageId/intro/outro and was never
// written by any code path. But a draft COULD carry it, so parsing must not throw,
// must preserve the flags, and must leave `kit` null — there is nothing to snapshot.
const legacy = ReelOptions.parse({
  branding: { logoImageId: "images/old-logo.png", intro: true, outro: false },
});
assert.strictEqual(legacy.branding.intro, true);
assert.strictEqual(legacy.branding.outro, false);
assert.strictEqual(legacy.branding.watermark, false);
assert.strictEqual(legacy.branding.kit, null);
assert.strictEqual(legacy.branding.logoImageId, "images/old-logo.png");

// ── The snapshot ────────────────────────────────────────────────────────────
const snap = {
  brandName: "Sentezy",
  handle: "@sentezy",
  logoImageId: "brand/logo.png",
  color: "#FF5A1F",
  font: "General Sans",
  outroCta: "Hemen dene",
  introClip: null,
  outroClip: { ref: "brand/outro.mp4", ms: 2400 },
};
const applied = ReelOptions.parse({
  branding: { intro: true, outro: true, watermark: true, kit: snap },
});
assert.deepStrictEqual(applied.branding.kit, snap);
assert.strictEqual(applied.branding.watermark, true);

// A snapshot round-trips through ReelOptions unchanged — the whole point is that it is
// frozen, so re-parsing a stored video must not mutate or drop any field.
assert.deepStrictEqual(ReelOptions.parse(applied).branding.kit, snap);

// A bare {} snapshot fills its own defaults rather than failing — a kit the user has
// barely filled in is still a valid kit.
assert.deepStrictEqual(BrandSnapshot.parse({}), {
  brandName: null,
  handle: null,
  logoImageId: null,
  color: "#0A0A0B",
  font: "General Sans",
  outroCta: null,
  introClip: null,
  outroClip: null,
});

// ── Validation ──────────────────────────────────────────────────────────────
// The colour is injected straight into the rendered card, so it must be a real hex.
assert.throws(() => BrandSnapshot.parse({ color: "red" }));
assert.throws(() => BrandSnapshot.parse({ color: "#fff" }));
assert.ok(BrandSnapshot.parse({ color: "#aabbcc" }));
assert.ok(BrandSnapshot.parse({ color: "#AABBCC" }));

// A clip duration drives the audio offset for the WHOLE reel — a zero or negative value
// would desynchronise the voiceover, so it must be rejected rather than defaulted.
assert.throws(() => BrandSnapshot.parse({ introClip: { ref: "brand/i.mp4", ms: 0 } }));
assert.throws(() => BrandSnapshot.parse({ introClip: { ref: "brand/i.mp4", ms: -5 } }));
assert.throws(() => BrandSnapshot.parse({ introClip: { ref: "brand/i.mp4", ms: 1.5 } }));
// A clip without a duration is likewise unusable.
assert.throws(() => BrandSnapshot.parse({ introClip: { ref: "brand/i.mp4" } }));

console.log("packages/types/src/branding.test.ts ok");
