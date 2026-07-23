import type { CaptionWord } from "@sentezy/remotion";

const SAMPLE = "Our biggest sale starts this weekend fifty percent off everything";
const PER_WORD = 0.42; // synthetic seconds per word (~143 wpm; preview has no real TTS timing)

/** Build synthetic word timings from a script (or a sample) for the live caption preview.
 *  Covers the WHOLE script so the preview length tracks the real speaking time (no word cap). */
export function previewWords(script: string): CaptionWord[] {
  const src = script.trim() ? script.trim() : SAMPLE;
  const toks = src.split(/\s+/);
  return toks.map((t, i) => ({ text: t, start: i * PER_WORD, end: i * PER_WORD + PER_WORD * 0.9 }));
}
