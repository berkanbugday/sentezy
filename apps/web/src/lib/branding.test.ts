import assert from "node:assert";
import { brandingOption } from "./branding";
import type { BrandKit } from "./queries";

const OFF = { brandIntro: false, brandOutro: false, brandWatermark: false };
const ALL = { brandIntro: true, brandOutro: true, brandWatermark: true };

const KIT: BrandKit = {
  brandName: "Sentezy",
  handle: "@sentezy",
  logoKey: "brand/logo.png",
  color: "#FF5A1F",
  font: "Poppins",
  outroCta: "Hemen dene",
  introClipKey: null,
  introClipMs: null,
  outroClipKey: "brand/outro.mp4",
  outroClipMs: 2400,
  // Signed previews — must never be persisted onto a video.
  logoUrl: "https://signed/logo.png?exp=1",
  introClipUrl: null,
  outroClipUrl: "https://signed/outro.mp4?exp=1",
};

// ── Unbranded ───────────────────────────────────────────────────────────────
// All toggles off writes nothing at all, so an unbranded video's options are exactly
// what they were before this feature existed.
assert.deepStrictEqual(brandingOption(OFF, KIT), {});
assert.deepStrictEqual(brandingOption(OFF, null), {});

// Toggles on but no usable kit → still nothing. A card with no logo and no name is an
// empty coloured screen; better to ship no branding than a blank intro.
assert.deepStrictEqual(brandingOption(ALL, null), {});
assert.deepStrictEqual(brandingOption(ALL, undefined), {});
assert.deepStrictEqual(brandingOption(ALL, { ...KIT, logoKey: null, brandName: null }), {});
// A name alone is enough — the card renders as name-only.
assert.ok(brandingOption(ALL, { ...KIT, logoKey: null }).branding);

// ── The snapshot ────────────────────────────────────────────────────────────
const out = brandingOption(ALL, KIT).branding as Record<string, unknown>;
assert.strictEqual(out.intro, true);
assert.strictEqual(out.outro, true);
assert.deepStrictEqual(out.kit, {
  brandName: "Sentezy",
  handle: "@sentezy",
  logoImageId: "brand/logo.png",
  color: "#FF5A1F",
  font: "Poppins",
  outroCta: "Hemen dene",
  introClip: null,
  outroClip: { ref: "brand/outro.mp4", ms: 2400 },
});

// Signed URLs expire within a day — persisting one would store a dead link on the video.
const serialised = JSON.stringify(out);
assert.ok(!serialised.includes("https://signed/"), "no signed URL may be snapshotted");
assert.ok(!serialised.includes("logoUrl"));

// ── Independence and guards ─────────────────────────────────────────────────
const introOnly = brandingOption({ brandIntro: true, brandOutro: false, brandWatermark: false }, KIT)
  .branding as Record<string, unknown>;
assert.strictEqual(introOnly.intro, true);
assert.strictEqual(introOnly.outro, false);
assert.strictEqual(introOnly.watermark, false);

// A watermark with no logo has nothing to stamp, so it is forced off even when requested.
const noLogo = brandingOption(ALL, { ...KIT, logoKey: null }).branding as Record<string, unknown>;
assert.strictEqual(noLogo.watermark, false);
assert.strictEqual(noLogo.intro, true, "the card still renders from the name alone");

// A clip missing its duration is dropped rather than sent without one — the duration
// shifts the voiceover for the whole reel, and the API would reject the pair anyway.
const halfClip = brandingOption(ALL, { ...KIT, outroClipMs: null }).branding as Record<string, unknown>;
assert.strictEqual((halfClip.kit as Record<string, unknown>).outroClip, null);

console.log("apps/web/src/lib/branding.test.ts ok");
