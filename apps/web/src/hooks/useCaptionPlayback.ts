"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WORDS_PER_SECOND = 2.4; // rough reel narration pace, matches the compose step's feel

/** Split a string into caption words the same way the frame renders them. */
export function toWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Split a script into caption lines — one sentence per line. Real reels show a
 * few words at a time, never the whole script, so the preview shows the current
 * sentence only. Splits after sentence punctuation or on line breaks.
 */
export function toSentences(script: string): string[] {
  return script
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Estimated spoken duration of a script, in seconds. */
export function estimateDuration(script: string): number {
  return toWords(script).length / WORDS_PER_SECOND;
}

type Playback = {
  playing: boolean;
  /** Index of the word currently highlighted (across the whole script), or -1 when idle. */
  activeWord: number;
  /** 0–1 progress through the script. */
  progress: number;
  toggle: () => void;
  stop: () => void;
};

/**
 * Drives the karaoke-style caption playback in ReelPreview: steps through the
 * script word-by-word at a natural pace so the preview "plays" like the reel
 * will. No audio — this simulates timing and look only. Honors reduced-motion
 * by snapping to the last word. `total` is the script's word count; `resetKey`
 * (the script) restarts playback whenever the text changes.
 */
export function useCaptionPlayback(total: number, resetKey: string): Playback {
  const [playing, setPlaying] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clear();
    setPlaying(false);
    setActiveWord(-1);
  }, [clear]);

  // Reset whenever the script changes so we never index past the new text.
  useEffect(() => {
    stop();
  }, [resetKey, stop]);

  useEffect(() => () => clear(), [clear]);

  const toggle = useCallback(() => {
    if (total === 0) return;
    if (playing) {
      stop();
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setActiveWord(total - 1);
      return;
    }
    setPlaying(true);
    setActiveWord(0);
    const step = (i: number) => {
      timer.current = setTimeout(() => {
        if (i >= total - 1) {
          setPlaying(false);
          setActiveWord(-1);
          return;
        }
        setActiveWord(i + 1);
        step(i + 1);
      }, 1000 / WORDS_PER_SECOND);
    };
    step(0);
  }, [playing, stop, total]);

  const progress = total === 0 || activeWord < 0 ? 0 : (activeWord + 1) / total;
  return { playing, activeWord, progress, toggle, stop };
}
