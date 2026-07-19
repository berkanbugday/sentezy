// The four extra video settings surfaced in the dashboard "Ek ayarlar" modal.
// Everything else the composer needs — avatar, voice, music, caption style — lives in
// MediaComposer's own state, next to the chip that picks it.
// Every video is 9:16; there is no aspect-ratio setting.

export type ComposerSettings = {
  /** Where the cut-out avatar sits: an edge, or bottom-centred. */
  avatarPosition: "left" | "center" | "right";
  captionPosition: "top" | "bottom";
  /** ElevenLabs v3 audio tag ("" = natural delivery). */
  voiceEmotion: string;
  /** Whoosh on each B-roll transition — only audible with 2+ clips. */
  transitionSfx: boolean;
};

export const DEFAULT_SETTINGS: ComposerSettings = {
  avatarPosition: "left",
  captionPosition: "top",
  voiceEmotion: "",
  transitionSfx: true,
};
