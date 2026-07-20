import assert from "node:assert";
import { brandFingerprint, toBrandDraft } from "./brandDraft";
import type { BrandKit } from "./queries";

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
  outroClipCrop: { x: 0.2, y: 0.8, scale: 1.5 },
  logoUrl: "https://r2/logo.png?X-Amz-Date=20260720T000000Z&X-Amz-Signature=aaa",
  introClipUrl: null,
  outroClipUrl: "https://r2/outro.mp4?X-Amz-Date=20260720T000000Z&X-Amz-Signature=bbb",
};

// ── toBrandDraft ────────────────────────────────────────────────────────────
const draft = toBrandDraft(KIT);
assert.strictEqual(draft.brandName, "Sentezy");
assert.deepStrictEqual(draft.outroClip, {
  key: "brand/outro.mp4",
  ms: 2400,
  url: KIT.outroClipUrl,
  crop: { x: 0.2, y: 0.8, scale: 1.5 },
});
// A clip missing its duration is not a usable clip, so it does not become one.
assert.strictEqual(toBrandDraft({ ...KIT, outroClipMs: null }).outroClip, null);
// Nulls become empty strings so React inputs stay controlled.
assert.strictEqual(toBrandDraft({ ...KIT, brandName: null }).brandName, "");
// A clip saved before cropping existed defaults to centred and unzoomed.
assert.deepStrictEqual(toBrandDraft({ ...KIT, outroClipCrop: null }).outroClip?.crop, {
  x: 0.5,
  y: 0.5,
  scale: 1,
});

// ── brandFingerprint ────────────────────────────────────────────────────────
// THE REGRESSION THIS EXISTS FOR: the API re-signs every URL it returns, so the same
// saved kit comes back with different signatures. If those counted, the form would be
// dirty the instant it was saved — Kaydet stuck enabled, "Kaydedildi" never shown.
const reSigned = toBrandDraft({
  ...KIT,
  logoUrl: "https://r2/logo.png?X-Amz-Date=20260721T111111Z&X-Amz-Signature=zzz",
  outroClipUrl: "https://r2/outro.mp4?X-Amz-Date=20260721T111111Z&X-Amz-Signature=yyy",
});
assert.strictEqual(brandFingerprint(draft), brandFingerprint(reSigned), "signed URLs must not count");

// Every persisted field DOES count.
assert.notStrictEqual(brandFingerprint(draft), brandFingerprint({ ...draft, brandName: "Başka" }));
assert.notStrictEqual(brandFingerprint(draft), brandFingerprint({ ...draft, color: "#000000" }));
assert.notStrictEqual(brandFingerprint(draft), brandFingerprint({ ...draft, font: "Inter" }));
assert.notStrictEqual(brandFingerprint(draft), brandFingerprint({ ...draft, logoKey: null }));
assert.notStrictEqual(brandFingerprint(draft), brandFingerprint({ ...draft, outroClip: null }));

// Re-cropping is a real change — it is persisted and it changes the render.
assert.notStrictEqual(
  brandFingerprint(draft),
  brandFingerprint({ ...draft, outroClip: { ...draft.outroClip!, crop: { x: 0.9, y: 0.1, scale: 2 } } }),
);

// Trailing whitespace is not a change: save trims it, so arming the button for an edit
// that would persist identically is a lie.
assert.strictEqual(brandFingerprint(draft), brandFingerprint({ ...draft, brandName: "Sentezy  " }));

console.log("apps/web/src/lib/brandDraft.test.ts ok");
