import assert from "node:assert";
import { applyEmotionTag } from "./elevenlabs";

// The six tones the drawer offers (wizard/constants.ts VOICE_EMOTIONS).
const TONES = ["", "warmly", "excited", "cheerfully", "seriously", "sincerely"];

// "" is Doğal — no tag, the script goes through untouched.
assert.strictEqual(applyEmotionTag("Merhaba dünya.", ""), "Merhaba dünya.");
assert.strictEqual(applyEmotionTag("Merhaba dünya.", undefined), "Merhaba dünya.");
assert.strictEqual(applyEmotionTag("Merhaba dünya.", "   "), "Merhaba dünya.");

// Every real tone prepends its v3 audio tag.
for (const tone of TONES.filter(Boolean)) {
  assert.strictEqual(applyEmotionTag("Merhaba dünya.", tone), `[${tone}] Merhaba dünya.`);
}

// An already-annotated script wins — the per-sentence pass must not be overridden.
assert.strictEqual(
  applyEmotionTag("[excited] Merhaba! [warmly] Hoş geldin.", "seriously"),
  "[excited] Merhaba! [warmly] Hoş geldin.",
);

// A bracketed non-tag (e.g. a bracketed number) is not mistaken for an existing tag.
assert.strictEqual(applyEmotionTag("[1] Merhaba.", "warmly"), "[warmly] [1] Merhaba.");

console.log("apps/api/src/lib/emotion.test.ts ok");
