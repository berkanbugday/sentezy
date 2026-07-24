import { BROLL_EFFECT_META } from "@sentezy/types";

export const fieldClass =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-signal";

// Per-clip B-roll effect catalog — the curated Remotion-native set (BROLL_EFFECT_META),
// grouped into between-clip transitions and per-clip entrance effects.
// Each tile renders a REAL Remotion preview (EffectTile → BrollEffectDemo). The worker maps
// these ids to xfade for the ffmpeg fallback engine.
export const DEFAULT_TRANSITION = "fade";
export const TRANSITIONS: { group: string; items: { value: string; label: string }[] }[] = [
  { group: "Transitions", items: BROLL_EFFECT_META.filter((e) => e.kind === "transition").map((e) => ({ value: e.id, label: e.label })) },
  { group: "Effects", items: BROLL_EFFECT_META.filter((e) => e.kind === "entrance").map((e) => ({ value: e.id, label: e.label })) },
];

export function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
    active ? "border-signal bg-[var(--wash)] text-signal" : "border-hairline text-ink hover:border-signal/50"
  }`;
}

export const CAPTION_STYLES = [
  { value: "karaoke", label: "Karaoke", hint: "Each word lights up as it is said" },
  { value: "tiktok", label: "TikTok", hint: "Word by word, colour on the accent" },
  { value: "beast", label: "Beast", hint: "Huge, all caps, pops on the beat" },
  { value: "hormozi", label: "Hormozi", hint: "Big, loud, colour on key words" },
  { value: "boxed", label: "Boxed", hint: "Words in a solid box" },
  { value: "keyword", label: "Keyword", hint: "The important word stays coloured" },
  { value: "clean", label: "Clean", hint: "Full sentence, no effects" },
] as const;

// Voice emotion → ElevenLabs v3 audio tag ("" = natural). Also drives the audio-driven
// HeyGen Avatar IV face, so the avatar looks more emotive too.
export const VOICE_EMOTIONS = [
  { value: "", label: "Natural" },
  { value: "warmly", label: "Warm" },
  { value: "excited", label: "Energetic" },
  { value: "cheerfully", label: "Cheerful" },
  { value: "seriously", label: "Serious" },
  { value: "sincerely", label: "Sincere" },
] as const;
