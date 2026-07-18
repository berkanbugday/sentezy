import type { CaptionWord } from "@sentezy/remotion";

const SAMPLE = "Bu hafta sonu büyük indirim başlıyor yüzde elli fırsatı kaçırma";
const PER_WORD = 0.42; // synthetic seconds per word (preview has no real TTS timing)

/** Build synthetic word timings from a script (or a sample) for the live caption preview. */
export function previewWords(script: string): CaptionWord[] {
  const src = script.trim() ? script.trim() : SAMPLE;
  const toks = src.split(/\s+/).slice(0, 14);
  return toks.map((t, i) => ({ text: t, start: i * PER_WORD, end: i * PER_WORD + PER_WORD * 0.9 }));
}
