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
  layout: "bottom",
  position: "bottom",
  avatarSide: "right",
  width: 1080,
  height: 1920,
  fps: 30,
};

export const SAMPLE_REEL_PROPS: ReelProps = {
  words: SAMPLE_WORDS,
  avatarUrl: null,
  broll: [],
  captionStyle: { styleId: "highlight", font: "Poppins", color: "#FFD54A" },
  layout: "bottom",
  position: "bottom",
  avatarSide: "right",
  captions: true,
  previewAudio: false,
  sfxCues: [],
  width: 1080,
  height: 1920,
  fps: 30,
};
