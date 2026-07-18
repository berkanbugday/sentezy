import { BROLL_EFFECT_META } from "@sentezy/types";
import type { CreateReelValues } from "@/lib/schemas";

export const fieldClass =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-signal";

// Per-clip B-roll effect catalog — the curated Remotion-native set (BROLL_EFFECT_META),
// grouped into between-clip transitions (Geçişler) and per-clip entrance effects (Efektler).
// Each tile renders a REAL Remotion preview (EffectTile → BrollEffectDemo). The worker maps
// these ids to xfade for the ffmpeg fallback engine.
export const DEFAULT_TRANSITION = "fade";
export const TRANSITIONS: { group: string; items: { value: string; label: string }[] }[] = [
  { group: "Geçişler", items: BROLL_EFFECT_META.filter((e) => e.kind === "transition").map((e) => ({ value: e.id, label: e.label })) },
  { group: "Efektler", items: BROLL_EFFECT_META.filter((e) => e.kind === "entrance").map((e) => ({ value: e.id, label: e.label })) },
];

export function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
    active ? "border-signal bg-[var(--wash)] text-signal" : "border-hairline text-ink hover:border-signal/50"
  }`;
}

export const RATIOS: { value: CreateReelValues["aspectRatio"]; label: string; w: number; h: number }[] = [
  { value: "9:16", label: "Reels · Story", w: 18, h: 32 },
  { value: "1:1", label: "Kare · Feed", w: 28, h: 28 },
  { value: "16:9", label: "Yatay · YouTube", w: 34, h: 19 },
];

export const CAPTION_STYLES = [
  { value: "karaoke", label: "Karaoke", hint: "Kelime kelime parlar" },
  { value: "tiktok", label: "TikTok", hint: "Kelime kelime, renkli vurgu" },
  { value: "beast", label: "Beast", hint: "Kocaman, büyük harf, patlar" },
  { value: "hormozi", label: "Vurgulu", hint: "Büyük, enerjik, renkli" },
  { value: "boxed", label: "Kutulu", hint: "CapCut baloncuk kutusu" },
  { value: "keyword", label: "Anahtar", hint: "Önemli kelime renkli kalır" },
  { value: "clean", label: "Sade", hint: "Tüm cümle, sakin" },
] as const;

// Voice emotion → ElevenLabs v3 audio tag ("" = natural). Also drives the audio-driven
// HeyGen Avatar IV face, so the avatar looks more emotive too.
export const VOICE_EMOTIONS = [
  { value: "", label: "Doğal" },
  { value: "warmly", label: "Sıcak" },
  { value: "excited", label: "Enerjik" },
  { value: "cheerfully", label: "Neşeli" },
  { value: "seriously", label: "Ciddi" },
  { value: "sincerely", label: "Samimi" },
] as const;
