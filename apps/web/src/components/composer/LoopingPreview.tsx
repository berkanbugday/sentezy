"use client";

import { Player, type PlayerRef } from "@remotion/player";
import type { ComponentType } from "react";
import { useEffect, useRef } from "react";

/**
 * A self-animating Remotion preview. Instead of relying on `<Player autoPlay>` / `play()` (which
 * is unreliable across browsers even for muted content), it drives the frame directly with a
 * requestAnimationFrame loop calling `seekTo` — so the preview ALWAYS loops. Used by the effect
 * and caption tiles so the whole grid animates.
 */
export function LoopingPreview<T extends Record<string, unknown>>({
  component,
  inputProps,
  durationInFrames,
  fps,
  compositionWidth,
  compositionHeight,
  playing = true,
  style,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: Remotion composition component prop typing
  component: ComponentType<any>;
  inputProps: T;
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  playing?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<PlayerRef>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = ref.current;
      if (p) {
        const dt = (now - last) / 1000;
        frame = (frame + dt * fps) % durationInFrames;
        p.seekTo(frame);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationInFrames, fps]);

  return (
    <Player
      ref={ref}
      component={component}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      controls={false}
      style={style}
    />
  );
}
