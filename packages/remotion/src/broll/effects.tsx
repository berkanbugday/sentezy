import {
  linearTiming,
  TransitionSeries,
  type TransitionPresentation,
  type TransitionPresentationComponentProps,
  type TransitionTiming,
} from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export { TransitionSeries };

// The per-clip entrance-animation ids — mirrors @sentezy/types BROLL_EFFECT_META (kind: "entrance").
// Inlined (not imported) so the Remotion bundle carries NO runtime @sentezy/types dependency: the
// Cloudflare container renders packages/remotion standalone, without the workspace package.
const ENTRANCE = new Set<string>(["zoompunch", "shake", "glitch", "whip", "flash"]);
/** True if the effect is a per-clip entrance animation (vs a between-clip transition). */
export const isEntrance = (id: string): boolean => ENTRANCE.has(id);

type PProps = TransitionPresentationComponentProps<Record<string, never>>;

// ── Custom Remotion transition presentations (beyond the built-in fade/slide/wipe/flip/clockWipe) ──

/** Zoom: entering clip scales down into place + fades; exiting drifts back slightly. */
const Zoom: React.FC<PProps> = ({ presentationProgress: p, presentationDirection: d, children }) => {
  const entering = d === "entering";
  const scale = entering ? interpolate(p, [0, 1], [1.18, 1]) : interpolate(p, [0, 1], [1, 0.92]);
  return <AbsoluteFill style={{ opacity: entering ? p : 1 - p, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};
const zoomPresentation = (): TransitionPresentation<Record<string, never>> => ({ component: Zoom, props: {} });

/** Blur dissolve: cross-fade with a focus-pull blur on both sides. */
const Blur: React.FC<PProps> = ({ presentationProgress: p, presentationDirection: d, children }) => {
  const entering = d === "entering";
  const blur = entering ? interpolate(p, [0, 1], [26, 0]) : interpolate(p, [0, 1], [0, 26]);
  return <AbsoluteFill style={{ opacity: entering ? p : 1 - p, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};
const blurPresentation = (): TransitionPresentation<Record<string, never>> => ({ component: Blur, props: {} });

/** Iris: the incoming clip is revealed by an expanding circle over the outgoing one. */
const Iris: React.FC<PProps> = ({ presentationProgress: p, presentationDirection: d, children }) => {
  if (d !== "entering") return <AbsoluteFill>{children}</AbsoluteFill>;
  const r = interpolate(p, [0, 1], [0, 140]);
  return <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 50%)` }}>{children}</AbsoluteFill>;
};
const irisPresentation = (): TransitionPresentation<Record<string, never>> => ({ component: Iris, props: {} });

/** Push: the incoming clip slides in from the right as the outgoing slides out to the left. */
const Push: React.FC<PProps> = ({ presentationProgress: p, presentationDirection: d, children }) => {
  const x = d === "entering" ? (1 - p) * 100 : -p * 100;
  return <AbsoluteFill style={{ transform: `translateX(${x}%)` }}>{children}</AbsoluteFill>;
};
const pushPresentation = (): TransitionPresentation<Record<string, never>> => ({ component: Push, props: {} });

const timing = (frames: number): TransitionTiming => linearTiming({ durationInFrames: Math.max(3, frames) });

/**
 * Resolve a B-roll effect id to a Remotion transition presentation + timing. Entrance-kind ids
 * use a quick near-cut so their per-clip `BrollEntrance` animation pops; transition-kind ids use
 * the matching (built-in or custom) presentation.
 */
// Built-in presentations (fade/slide/…) and the custom ones above are each generic over their own
// props type, so the unified return uses `any` for the presentation's prop generic — TransitionSeries
// accepts any TransitionPresentation<T>.
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous presentation prop types
export function brollTransition(
  id: string,
  o: { fps: number; width: number; height: number },
): { presentation: TransitionPresentation<any>; timing: TransitionTiming } {
  const t = timing(Math.round(o.fps * 0.4));
  switch (id) {
    case "fade":
      return { presentation: fade(), timing: t };
    case "slide":
      return { presentation: slide({ direction: "from-right" }), timing: t };
    case "wipe":
      return { presentation: wipe({ direction: "from-left" }), timing: t };
    case "flip":
      return { presentation: flip(), timing: t };
    case "clockwipe":
      return { presentation: clockWipe({ width: o.width, height: o.height }), timing: t };
    case "iris":
      return { presentation: irisPresentation(), timing: t };
    case "zoom":
      return { presentation: zoomPresentation(), timing: t };
    case "blur":
      return { presentation: blurPresentation(), timing: t };
    case "push":
      return { presentation: pushPresentation(), timing: t };
    default:
      // entrance ids → quick near-cut so the entrance animation carries the punch
      return { presentation: fade(), timing: timing(Math.round(o.fps * 0.12)) };
  }
}

/**
 * Per-clip entrance animation for the "viral" effects (zoom-punch, shake, glitch, whip, flash),
 * applied over the clip's first frames. A no-op for non-entrance ids. Reads the clip-local frame
 * (0 at the clip's start inside its TransitionSeries.Sequence).
 */
export const BrollEntrance: React.FC<{ effectId: string; children: React.ReactNode }> = ({ effectId, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!ENTRANCE.has(effectId)) return <>{children}</>;
  const s = (sec: number) => Math.round(fps * sec);

  let style: React.CSSProperties = {};
  let overlay: React.ReactNode = null;

  if (effectId === "zoompunch") {
    const scale = interpolate(frame, [0, s(0.18), s(0.5)], [1.35, 1.05, 1], { extrapolateRight: "clamp" });
    style = { transform: `scale(${scale})` };
  } else if (effectId === "shake") {
    const k = interpolate(frame, [0, s(0.35)], [1, 0], { extrapolateRight: "clamp" });
    style = { transform: `translate(${Math.sin(frame * 2.1) * 18 * k}px, ${Math.cos(frame * 1.7) * 14 * k}px) scale(1.06)` };
  } else if (effectId === "glitch") {
    const on = frame < s(0.22);
    const dx = on ? Math.sin(frame * 9) * 10 : 0;
    style = { transform: `translateX(${dx}px)`, filter: on ? "saturate(1.5) contrast(1.15)" : undefined };
    overlay = on ? (
      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          opacity: 0.5,
          transform: `translateX(${-dx * 1.4}px)`,
          background: "linear-gradient(90deg, rgba(255,0,90,0.18), transparent 40%, rgba(0,180,255,0.18))",
        }}
      />
    ) : null;
  } else if (effectId === "whip") {
    const blur = interpolate(frame, [0, s(0.15)], [22, 0], { extrapolateRight: "clamp" });
    const dx = interpolate(frame, [0, s(0.15)], [70, 0], { extrapolateRight: "clamp" });
    style = { transform: `translateX(${dx}px)`, filter: `blur(${blur}px)` };
  } else if (effectId === "flash") {
    const o = interpolate(frame, [0, s(0.06), s(0.22)], [0.9, 0.6, 0], { extrapolateRight: "clamp" });
    overlay = <AbsoluteFill style={{ background: "#fff", opacity: o }} />;
  }

  return (
    <AbsoluteFill style={style}>
      {children}
      {overlay}
    </AbsoluteFill>
  );
};
