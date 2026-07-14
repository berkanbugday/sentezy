import type { CreateReelValues } from "@/lib/schemas";

export const fieldClass =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-signal";

// Per-photo transition catalog. `value` MUST match the worker's xfade allow-list
// (compose._XFADE_TRANSITIONS) plus the synthetic "cut". Grouped for a scannable menu.
export const DEFAULT_TRANSITION = "fade";
export const TRANSITIONS: { group: string; items: { value: string; label: string }[] }[] = [
  { group: "Efektler", items: [
    { value: "zoompunch", label: "Zoom vuruş" },
    { value: "flash", label: "Flaş" },
    { value: "shake", label: "Sarsıntı" },
    { value: "whip", label: "Savurma" },
    { value: "glitch", label: "Glitch" },
    { value: "dissolve", label: "Dağılma" },
    { value: "pixelize", label: "Pikselleştir" },
    { value: "radial", label: "Radyal" },
    { value: "zoomin", label: "Yakınlaştır" },
    { value: "distance", label: "Mesafe" },
    { value: "squeezev", label: "Sıkıştır · dikey" },
    { value: "squeezeh", label: "Sıkıştır · yatay" },
  ] },
  { group: "Temel", items: [
    { value: "fade", label: "Yumuşak geçiş" },
    { value: "cut", label: "Sert kesme" },
    { value: "fadeblack", label: "Siyaha geçiş" },
    { value: "fadewhite", label: "Beyaza geçiş" },
    { value: "fadegrays", label: "Griye geçiş" },
  ] },
  { group: "Kaydırma", items: [
    { value: "slideleft", label: "Sola kaydır" },
    { value: "slideright", label: "Sağa kaydır" },
    { value: "slideup", label: "Yukarı kaydır" },
    { value: "slidedown", label: "Aşağı kaydır" },
  ] },
  { group: "Silme", items: [
    { value: "wipeleft", label: "Sola sil" },
    { value: "wiperight", label: "Sağa sil" },
    { value: "wipeup", label: "Yukarı sil" },
    { value: "wipedown", label: "Aşağı sil" },
    { value: "wipetl", label: "Köşe · sol üst" },
    { value: "wipetr", label: "Köşe · sağ üst" },
    { value: "wipebl", label: "Köşe · sol alt" },
    { value: "wipebr", label: "Köşe · sağ alt" },
  ] },
  { group: "Yumuşak kaydırma", items: [
    { value: "smoothleft", label: "Yumuşak sol" },
    { value: "smoothright", label: "Yumuşak sağ" },
    { value: "smoothup", label: "Yumuşak yukarı" },
    { value: "smoothdown", label: "Yumuşak aşağı" },
  ] },
  { group: "Şekil", items: [
    { value: "circleopen", label: "Daire · aç" },
    { value: "circleclose", label: "Daire · kapat" },
    { value: "circlecrop", label: "Daire · kırp" },
    { value: "rectcrop", label: "Dikdörtgen · kırp" },
    { value: "horzopen", label: "Yatay · aç" },
    { value: "horzclose", label: "Yatay · kapat" },
    { value: "vertopen", label: "Dikey · aç" },
    { value: "vertclose", label: "Dikey · kapat" },
    { value: "diagtl", label: "Çapraz · sol üst" },
    { value: "diagtr", label: "Çapraz · sağ üst" },
    { value: "diagbl", label: "Çapraz · sol alt" },
    { value: "diagbr", label: "Çapraz · sağ alt" },
  ] },
  { group: "Dilim", items: [
    { value: "hlslice", label: "Yatay dilim · sol" },
    { value: "hrslice", label: "Yatay dilim · sağ" },
    { value: "vuslice", label: "Dikey dilim · yukarı" },
    { value: "vdslice", label: "Dikey dilim · aşağı" },
  ] },
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
// HeyGen Avatar IV face, so the presenter looks more emotive too.
export const VOICE_EMOTIONS = [
  { value: "", label: "Doğal" },
  { value: "warmly", label: "Sıcak" },
  { value: "excited", label: "Enerjik" },
  { value: "cheerfully", label: "Neşeli" },
  { value: "seriously", label: "Ciddi" },
  { value: "sincerely", label: "Samimi" },
] as const;
