import type { CaptionCompositionProps, CaptionWord } from "./types";
import type { ReelProps } from "./reel/types";

/** A sample Turkish line with word timings — used for Studio previews and default props. */
export const SAMPLE_WORDS: CaptionWord[] = [
  { text: "Bu", start: 0.0, end: 0.28 },
  { text: "hafta", start: 0.3, end: 0.66 },
  { text: "sonu", start: 0.68, end: 1.02 },
  { text: "büyük", start: 1.08, end: 1.52 },
  { text: "indirim", start: 1.56, end: 2.12 },
  { text: "başlıyor", start: 2.16, end: 2.78 },
  { text: "yüzde", start: 2.9, end: 3.3 },
  { text: "elli", start: 3.34, end: 3.7 },
  { text: "fırsatı", start: 3.76, end: 4.32 },
  { text: "kaçırma", start: 4.38, end: 5.0 },
];

export const SAMPLE_PROPS: CaptionCompositionProps = {
  words: SAMPLE_WORDS,
  styleId: "highlight",
  font: "Poppins",
  color: "#FFD54A",
  position: "bottom",
  width: 1080,
  height: 1920,
  fps: 30,
};

export const SAMPLE_REEL_PROPS: ReelProps = {
  words: SAMPLE_WORDS,
  avatarUrl: null,
  broll: [],
  captionStyle: { styleId: "highlight", font: "Poppins", color: "#FFD54A" },
  position: "bottom",
  avatarPosition: "right",
  captions: true,
  previewAudio: false,
  sfxCues: [],
  musicUrl: null,
  musicVolume: 0.15,
  // A brand with both ends on, so Remotion Studio shows the full intro → body → outro
  // shape. No logoUrl: Studio has no signed R2 URL to load, and the card is designed to
  // read as name-only when a kit has no logo yet.
  brand: {
    intro: { kind: "card" },
    outro: { kind: "card" },
    watermark: false,
    logoUrl: null,
    brandName: "Sentezy",
    handle: "@sentezy",
    cta: "Hemen dene",
    color: "#0A0A0B",
    font: "General Sans",
  },
  width: 1080,
  height: 1920,
  fps: 30,
};
