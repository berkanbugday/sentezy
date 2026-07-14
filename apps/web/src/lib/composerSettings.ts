// Extra video settings surfaced in the dashboard "additional settings" drawer — the
// generation options not shown as composer chips. Field names/enums mirror
// createReelSchema (src/lib/schemas.ts) so they seed the create-reel form 1:1.

export type ComposerSettings = {
  aspectRatio: "9:16" | "1:1" | "16:9";
  presenterLayout: "side" | "bottom";
  avatarSide: "left" | "right";
  captionPosition: "top" | "bottom";
  voiceEmotion: string;
  musicTrackKey?: string;
  musicVolume: number; // 0..0.4 (UI cap, so the bed never buries the voice)
  transitionSfx: boolean;
};

export const DEFAULT_SETTINGS: ComposerSettings = {
  aspectRatio: "9:16",
  presenterLayout: "side",
  avatarSide: "right",
  captionPosition: "bottom",
  voiceEmotion: "",
  musicVolume: 0.15,
  transitionSfx: true,
};
