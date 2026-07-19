import assert from "node:assert";
import { DEFAULT_PRESET, DEFAULT_PRESET_ID, presetIdFor } from "./captionStyles";
import { DEFAULT_SETTINGS } from "./composerSettings";
import { optionsToComposerState } from "./reuse";
import type { ApiVideo } from "./types";

const video = (options: Record<string, unknown>): ApiVideo =>
  ({ id: "v1", title: "t", status: "ready", stage: null, progress: 100, aspectRatio: "r9_16",
     outputKey: null, thumbnailImageId: null, thumbnailUrl: null, durationS: 10, creditsCost: 1,
     createdAt: "2026-07-19T00:00:00Z", script: "", options }) as unknown as ApiVideo;

// ── presetIdFor ─────────────────────────────────────────────────────────────
// Ids are deterministic, so a stored {style, font, color} rebuilds its own preset id.
assert.strictEqual(presetIdFor(DEFAULT_PRESET.base, DEFAULT_PRESET.font, DEFAULT_PRESET.color), DEFAULT_PRESET_ID);
// Non-accent families ignore colour entirely — their ids carry no colour segment.
assert.strictEqual(presetIdFor("clean", "Inter", "#FFD54A"), "clean-inter");
// Unknown family or font falls back rather than inventing an id.
assert.strictEqual(presetIdFor("nope", "Inter", "#FFFFFF"), DEFAULT_PRESET_ID);
assert.strictEqual(presetIdFor(DEFAULT_PRESET.base, "Comic Sans", DEFAULT_PRESET.color), DEFAULT_PRESET_ID);

// ── optionsToComposerState ──────────────────────────────────────────────────
// The caption preset a video was created with comes back exactly.
assert.strictEqual(
  optionsToComposerState(video({
    captions: { style: DEFAULT_PRESET.base, font: DEFAULT_PRESET.font, color: DEFAULT_PRESET.color },
  })).captionId,
  DEFAULT_PRESET_ID,
);

// New-shape options round-trip into the four-field settings object.
const fresh = optionsToComposerState(video({
  layout: { avatarPosition: "left", captionPosition: "top" },
  music: { trackKey: "upbeat", volume: 0.2 },
  voice: { emotion: "excited" },
  effects: { transitionSfx: false },
}));
assert.deepStrictEqual(fresh.settings, {
  avatarPosition: "left", captionPosition: "top", voiceEmotion: "excited", transitionSfx: false,
});
// Music is returned separately — it is MediaComposer state, not a setting.
assert.deepStrictEqual(fresh.music, { trackKey: "upbeat", volume: 0.2 });

// Legacy blobs (avatarLayout + avatarSide) map forward via readAvatarPosition.
assert.strictEqual(
  optionsToComposerState(video({ layout: { avatarLayout: "bottom", avatarSide: "left", captionPosition: "bottom" } })).settings.avatarPosition,
  "center",
);
assert.strictEqual(
  optionsToComposerState(video({ layout: { avatarLayout: "side", avatarSide: "left", captionPosition: "bottom" } })).settings.avatarPosition,
  "left",
);

// An empty options object yields the defaults and no music.
const empty = optionsToComposerState(video({}));
assert.strictEqual(empty.captionId, DEFAULT_PRESET_ID);
assert.deepStrictEqual(empty.settings, DEFAULT_SETTINGS);
assert.strictEqual(empty.music, null);

// A video from before the SFX feature was deleted must not resurrect any of it.
const legacySfx = optionsToComposerState(video({ sfx: { enabled: true, cues: [{ wordIndex: 3, sfxId: "pop" }] } }));
assert.deepStrictEqual(Object.keys(legacySfx.settings).sort(),
  ["avatarPosition", "captionPosition", "transitionSfx", "voiceEmotion"]);

console.log("apps/web/src/lib/reuse.test.ts ok");
