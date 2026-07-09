"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WORDS_PER_SECOND = 2.4; // rough reel narration pace, matches the compose step's feel

/** Split a script into caption words the same way the frame renders them. */
export function toWords(script: string): string[] {
  return script.trim().split(/\s+/).filter(Boolean);
}

/** Estimated spoken duration of a script, in seconds. */
export function estimateDuration(script: string): number {
  return toWords(script).length / WORDS_PER_SECOND;
}

type Playback = {
  playing: boolean;
  /** Index of the word currently highlighted, or -1 when idle/finished. */
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
 * by snapping to the full script instead of animating.
 */
export function useCaptionPlayback(script: string): Playback {
  const words = toWords(script);
  const total = words.length;
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
  }, [script, stop]);

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
