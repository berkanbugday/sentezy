import assert from "node:assert";
import { avatarSeed, pickSeed, seedKeys } from "./composerSeed";
import type { Avatar } from "../components/wizard/types";

const avatar = (id: string, name: string, ready = true): Avatar =>
  ({ id, slug: name.toLowerCase(), name, imageUrl: `https://x/${id}`, sector: "ecommerce",
     sectorLabel: "E-ticaret Markası", gender: "kadın", age: "genç", hijab: false, ready }) as Avatar;

const CATALOG = [avatar("avatars/beyza.png", "Beyza"), avatar("avatars/anna.png", "Anna")];

// ── avatarSeed ──────────────────────────────────────────────────────────────
const found = avatarSeed("avatars/beyza.png", CATALOG);
assert.ok(found, "a catalogued avatar must produce a seed");
assert.strictEqual(found.selectedAvatar?.name, "Beyza");
// The key is namespaced so an avatar seed and a reuse seed can never collide in the
// composer's seed-once ref (a video id and an avatar id could otherwise coincide).
assert.strictEqual(found.key, "avatar:avatars/beyza.png");

// An avatar seed carries EXACTLY one field. This is the whole point: voice, music and
// captions must be left alone, not cleared.
assert.deepStrictEqual(seedKeys(found), ["selectedAvatar"]);

// Unknown / unrendered / deleted id → no seed, so the caller can show its notice.
assert.strictEqual(avatarSeed("avatars/nope.png", CATALOG), undefined);
assert.strictEqual(avatarSeed("", CATALOG), undefined);
assert.strictEqual(avatarSeed("avatars/beyza.png", []), undefined);

// ── seedKeys: absent vs present-and-null ────────────────────────────────────
// A reuse seed sets every field, and `null` is a real value meaning "clear it".
const reuse: ReturnType<typeof pickSeed> = {
  key: "video-1", selectedAvatar: null, selectedVoice: null,
  selectedMusic: null, musicVolume: 0.15, captionId: null,
};
assert.deepStrictEqual(
  seedKeys(reuse!).sort(),
  ["captionId", "musicVolume", "selectedAvatar", "selectedMusic", "selectedVoice"],
);
// A field that is absent must NOT appear, even though a present `null` does.
assert.deepStrictEqual(seedKeys({ key: "k", captionId: null }), ["captionId"]);
assert.deepStrictEqual(seedKeys({ key: "k" }), []);
// An explicitly-undefined field is treated as absent, not a real value that clears.
assert.deepStrictEqual(seedKeys({ key: "k", selectedAvatar: undefined }), []);
// A deliberate `null` still clears.
assert.deepStrictEqual(seedKeys({ key: "k", captionId: null }), ["captionId"]);
// Zero is a real value, not absence.
assert.deepStrictEqual(seedKeys({ key: "k", musicVolume: 0 }), ["musicVolume"]);

// ── pickSeed: reuse wins ────────────────────────────────────────────────────
// A reuse carries a whole configuration; letting a lone avatar override part of it
// would be surprising.
assert.strictEqual(pickSeed(reuse, found)?.key, "video-1");
assert.strictEqual(pickSeed(undefined, found)?.key, "avatar:avatars/beyza.png");
assert.strictEqual(pickSeed(reuse, undefined)?.key, "video-1");
assert.strictEqual(pickSeed(undefined, undefined), undefined);

console.log("apps/web/src/lib/composerSeed.test.ts ok");
