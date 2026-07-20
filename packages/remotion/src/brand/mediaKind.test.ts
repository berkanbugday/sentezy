import assert from "node:assert";
import { isImageSrc } from "../reel/AvatarLayer";

// A brand intro/outro can be an image OR a video, and NOTHING stores which one it is —
// the composition, the preview and the worker all decide by looking at the source
// extension. If this drifts, an end-card image gets handed to <OffthreadVideo> (blank
// frame) or a video to <Img> (broken image), so it is pinned here.

// The extensions the API's EXT map can produce for an image upload.
for (const ext of ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"]) {
  assert.strictEqual(isImageSrc(`https://r2/brand/abc.${ext}`), true, `${ext} is an image`);
}

// ...and for a video upload. video/quicktime must land as .mov, not "quicktime".
for (const ext of ["mp4", "mov", "webm", "m4v"]) {
  assert.strictEqual(isImageSrc(`https://r2/brand/abc.${ext}`), false, `${ext} is a video`);
}

// These are SIGNED R2 URLs, so the extension is never at the end of the string. A check
// that forgot the query string would classify every real upload as a video.
assert.strictEqual(isImageSrc("https://r2/brand/abc.png?X-Amz-Signature=deadbeef&x=1"), true);
assert.strictEqual(isImageSrc("https://r2/brand/abc.mp4?X-Amz-Signature=deadbeef"), false);

// Case is not guaranteed — a phone can hand over IMG_0001.PNG.
assert.strictEqual(isImageSrc("https://r2/brand/ABC.PNG"), true);
assert.strictEqual(isImageSrc("https://r2/brand/ABC.MOV"), false);

// Unknown extension falls to the video branch, which is the safer default: a video
// element showing a still is recoverable, an <Img> pointed at an mp4 is not.
assert.strictEqual(isImageSrc("https://r2/brand/abc.bin"), false);

console.log("packages/remotion/src/brand/mediaKind.test.ts ok");
