import type { Avatar, Voice } from "@/components/wizard/types";
import type { MusicTrack } from "@/lib/queries";

/** The composer state a seed can set. Every field is OPTIONAL, and the distinction
 *  matters: an ABSENT key means "leave this alone", while a key present with `null`
 *  means "clear it". `?reuse=` sets all five; `?avatar=` sets only the avatar. */
export type ComposerSeedValues = {
  selectedAvatar?: Avatar | null;
  selectedVoice?: Voice | null;
  selectedMusic?: MusicTrack | null;
  musicVolume?: number;
  /** null = no caption style selected (captions are opt-in). */
  captionId?: string | null;
};

/** `key` identifies the seed's source; the composer seeds once per key. */
export type ComposerSeed = ComposerSeedValues & { key: string };

const VALUE_KEYS: (keyof ComposerSeedValues)[] = [
  "selectedAvatar", "selectedVoice", "selectedMusic", "musicVolume", "captionId",
];

/** The value keys this seed actually carries — i.e. the ones the composer should write.
 *  A key counts only when present AND its value is not `undefined`. This matches TypeScript's
 *  optional-property semantics: absent and present-but-undefined both mean "leave alone",
 *  while present-and-`null` means "clear it". Uses `!== undefined` to distinguish `null`
 *  (a real value that clears) from explicit absence. */
export function seedKeys(seed: ComposerSeed): (keyof ComposerSeedValues)[] {
  return VALUE_KEYS.filter((k) => k in seed && seed[k] !== undefined);
}

/** The seed for `/dashboard?avatar=<id>`: sets the avatar and nothing else.
 *  Returns undefined when the id is empty or not in the catalog (never rendered, or
 *  removed), so the caller can degrade to a normal new-video flow with a notice. */
export function avatarSeed(avatarId: string, avatars: Avatar[]): ComposerSeed | undefined {
  if (!avatarId) return undefined;
  const match = avatars.find((a) => a.id === avatarId);
  if (!match) return undefined;
  return { key: `avatar:${avatarId}`, selectedAvatar: match };
}

/** `?reuse=` wins over `?avatar=` — a reuse carries a whole configuration, so letting a
 *  lone avatar override part of it would be surprising. */
export function pickSeed(
  reuse: ComposerSeed | undefined,
  avatar: ComposerSeed | undefined,
): ComposerSeed | undefined {
  return reuse ?? avatar;
}
