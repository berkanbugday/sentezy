import { readAvatarPosition } from "@sentezy/types";
import { DEFAULT_PRESET_ID, presetIdFor } from "./captionStyles";
import { type ComposerSettings, DEFAULT_SETTINGS } from "./composerSettings";
import type { ApiVideo } from "./types";

type StoredOptions = {
  captions?: { style?: string; font?: string; color?: string };
  layout?: unknown; // readAvatarPosition handles both the new and the legacy shape
  music?: { trackKey?: string; volume?: number };
  voice?: { emotion?: string };
  effects?: { transitionSfx?: boolean };
};

/** Map a stored video back to composer state for "Yeniden kullan".
 *  Settings only — the script and the B-roll media are deliberately dropped.
 *  Music comes back separately because it is MediaComposer state, not a setting.
 *  Anything a video stored under the deleted `sfx` key is ignored: the feature is gone,
 *  and its cues were anchored to the OLD script's word indices anyway. */
export function optionsToComposerState(video: ApiVideo): {
  captionId: string;
  settings: ComposerSettings;
  music: { trackKey: string; volume: number } | null;
} {
  const o = (video.options ?? {}) as StoredOptions;
  const captionId = o.captions?.style
    ? presetIdFor(o.captions.style, o.captions.font ?? "", o.captions.color ?? "")
    : DEFAULT_PRESET_ID;

  const layout = (o.layout ?? {}) as { captionPosition?: string };
  const settings: ComposerSettings = {
    avatarPosition: readAvatarPosition(o.layout),
    captionPosition: (layout.captionPosition as ComposerSettings["captionPosition"]) ?? DEFAULT_SETTINGS.captionPosition,
    voiceEmotion: o.voice?.emotion ?? DEFAULT_SETTINGS.voiceEmotion,
    transitionSfx: o.effects?.transitionSfx ?? DEFAULT_SETTINGS.transitionSfx,
  };

  const music = o.music?.trackKey
    ? { trackKey: o.music.trackKey, volume: o.music.volume ?? 0.15 }
    : null;

  return { captionId, settings, music };
}
