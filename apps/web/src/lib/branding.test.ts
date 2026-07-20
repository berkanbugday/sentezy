import assert from "node:assert";
import { brandingOption, kitHasContent, previewBrand } from "./branding";
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
  introClipCrop: null,
  outroClipKey: "brand/outro.mp4",
  outroClipMs: 2400,
  outroClipCrop: { x: 0.5, y: 0.25, scale: 1.6 },
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
// No logo, no name AND no uploads — nothing renderable at all.
assert.deepStrictEqual(
  brandingOption(ALL, { ...KIT, logoKey: null, brandName: null, outroClipKey: null, outroClipMs: null }),
  {},
);
// A name alone is enough — the card renders as name-only.
assert.ok(brandingOption(ALL, { ...KIT, logoKey: null }).branding);

// ── Per-end usability ───────────────────────────────────────────────────────
// REGRESSION: a kit that is ONLY an uploaded intro video — no logo, no name — is
// perfectly usable, because that upload replaces the card entirely. An earlier
// whole-kit check rejected it and silently produced no branding at all.
const clipOnly = {
  ...KIT, logoKey: null, brandName: null, handle: null, outroCta: null,
  introClipKey: "brand/intro.mp4", introClipMs: 1500, introClipCrop: null,
  outroClipKey: null, outroClipMs: null, outroClipCrop: null,
  logoUrl: null, introClipUrl: "https://signed/intro.mp4", outroClipUrl: null,
};
const clipOnlyOut = brandingOption(ALL, clipOnly).branding as Record<string, unknown>;
assert.ok(clipOnlyOut, "an intro-only kit must still brand the video");
assert.strictEqual(clipOnlyOut.intro, true);
// ...but the OUTRO has no upload and no card content, so it stays off rather than
// opening on a blank coloured screen.
assert.strictEqual(clipOnlyOut.outro, false);
// ...and the watermark has no logo to stamp.
assert.strictEqual(clipOnlyOut.watermark, false);

// The preview agrees with the render on all of that, or it stops predicting it.
const clipOnlyPreview = previewBrand(ALL, clipOnly, 30);
assert.ok(clipOnlyPreview);
assert.strictEqual(clipOnlyPreview.intro?.kind, "clip");
assert.strictEqual(clipOnlyPreview.outro, null);
assert.strictEqual(clipOnlyPreview.watermark, false);

// ── kitHasContent ───────────────────────────────────────────────────────────
assert.strictEqual(kitHasContent(null), false);
assert.strictEqual(kitHasContent(undefined), false);
assert.strictEqual(kitHasContent(clipOnly), true, "an upload alone is a usable kit");
assert.strictEqual(kitHasContent({ ...KIT, logoKey: null, brandName: "X" }), true);
assert.strictEqual(
  kitHasContent({ ...KIT, logoKey: null, brandName: null, introClipKey: null, outroClipKey: null }),
  false,
);

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
  outroClip: { ref: "brand/outro.mp4", ms: 2400, crop: { x: 0.5, y: 0.25, scale: 1.6 } },
});

// The framing is snapshotted with everything else: re-cropping the kit later must not
// silently re-frame a video that has already been made.
const reCropped = brandingOption(ALL, { ...KIT, outroClipCrop: { x: 0.1, y: 0.9, scale: 2 } })
  .branding as Record<string, unknown>;
assert.deepStrictEqual(
  ((reCropped.kit as Record<string, unknown>).outroClip as Record<string, unknown>).crop,
  { x: 0.1, y: 0.9, scale: 2 },
);

// A clip stored before cropping existed snapshots as centred and unzoomed rather than
// undefined, so the renderer never has to guess.
const noCrop = brandingOption(ALL, { ...KIT, outroClipCrop: null }).branding as Record<string, unknown>;
assert.deepStrictEqual(
  ((noCrop.kit as Record<string, unknown>).outroClip as Record<string, unknown>).crop,
  { x: 0.5, y: 0.5, scale: 1 },
);

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
