"use client";

import { STAGE_LABEL, type VideoStage } from "@/lib/types";

/** The four stages a render passes through, in pipeline order. The index drives the rail below,
 *  so a viewer can see how far along a video is without reading the percentage. */
const ORDER: Exclude<VideoStage, "done" | null>[] = ["tts", "avatar", "compose", "thumbnail"];

/**
 * The placeholder shown where a video will be. Rather than one generic shimmer, each stage draws
 * the thing it is actually doing — a voice waveform, an avatar being scanned, layers stacking,
 * a frame being captured. The motion carries the information, so the wait is legible at a glance
 * instead of merely "busy".
 *
 * `compact` is the grid-tile form: the glyph alone, no label or rail (the card's status badge
 * already names the state, and a tile is too small for text).
 */
export function RenderStage({
  stage,
  progress,
  compact = false,
}: {
  stage: VideoStage;
  progress: number;
  compact?: boolean;
}) {
  const active = stage && stage !== "done" ? stage : null;
  const idx = active ? ORDER.indexOf(active) : -1;
  const size = compact ? 34 : 58;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">
        {active ? STAGE_LABEL[active] : "Sıraya alındı"} — %{Math.round(progress)}
      </span>

      <Glyph stage={active} size={size} />

      {!compact && (
        <>
          <p className="text-[13px] font-medium text-ink">{active ? STAGE_LABEL[active] : "Sıraya alındı"}</p>

          {/* Four segments, one per stage: filled behind, live in front, empty ahead. A discrete
           *  rail beats a single bar here because the backend reports stages, not smooth progress —
           *  the percentage jumps, but the segment it lands in is always true. */}
          <div className="flex w-full max-w-[150px] items-center gap-1.5" aria-hidden>
            {ORDER.map((s, i) => (
              <span
                key={s}
                className={`h-[3px] flex-1 rounded-full ${
                  i < idx ? "bg-ink" : i === idx ? "rs-seg bg-ink" : "bg-hairline"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Stage glyphs share a 24-box, 1.7 stroke and currentColor so they sit on the same optical
 *  weight as the app's icon set. Each animates only the part that means something. */
function Glyph({ stage, size }: { stage: VideoStage; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "text-ink",
  };

  // Speaking: an equalizer whose bars rise and fall out of phase, the way a voice does.
  if (stage === "tts") {
    return (
      <svg {...common}>
        {[4.5, 8.25, 12, 15.75, 19.5].map((x, i) => (
          <line key={x} x1={x} y1={7} x2={x} y2={17} className="rs-bar" style={{ animationDelay: `${i * 0.11}s` }} />
        ))}
      </svg>
    );
  }

  // Avatar: a portrait with a ring pulsing outward — the photo being read, not a spinner.
  if (stage === "avatar") {
    return (
      <svg {...common}>
        <circle cx="12" cy="9.5" r="3.4" />
        <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        <circle cx="12" cy="12" r="9" className="rs-sonar" strokeWidth={1.2} />
      </svg>
    );
  }

  // Compose: three layers drifting into register, which is literally what the compositor does.
  if (stage === "compose") {
    return (
      <svg {...common}>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={4}
            y={5.5 + i * 4.75}
            width={16}
            height={3.5}
            rx={1.4}
            className="rs-layer"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </svg>
    );
  }

  // Thumbnail: a frame with an aperture closing on it — the poster frame being taken.
  if (stage === "thumbnail") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="12" cy="12" r="4" className="rs-iris" />
      </svg>
    );
  }

  // Queued: nothing is running yet, so the dots idle rather than imply work in progress.
  return (
    <svg {...common}>
      {[6.5, 12, 17.5].map((x, i) => (
        <circle key={x} cx={x} cy={12} r={1.6} fill="currentColor" stroke="none" className="rs-dot" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </svg>
  );
}
