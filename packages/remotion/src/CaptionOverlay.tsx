import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EFFECTS } from "./effects/registry";
import { resolveFamily } from "./fonts";
import { captionBox, captionBoxWidth } from "./layout";
import { buildPages } from "./timing";
import type { CaptionOverlayProps } from "./types";

// Approx average glyph advance as a fraction of font size, per bundled family — condensed fonts
// are narrower. Used to size the font so the longest word fits the caption column (no mid-word
// break, no overflow) regardless of layout.
const CHAR_W: Record<string, number> = {
  "General Sans": 0.55,
  Anton: 0.42,
  "Archivo Black": 0.64,
  "Bebas Neue": 0.4,
  Fredoka: 0.58,
  Inter: 0.54,
  Kanit: 0.52,
  Montserrat: 0.56,
  Oswald: 0.48,
  Poppins: 0.58,
  Rubik: 0.56,
  Sora: 0.56,
  Teko: 0.4,
};

/**
 * The single parameterised caption composition. Renders a **transparent** full-frame
 * overlay: the Cloudflare container renders it to a ProRes 4444 .mov the worker composites
 * over the reel, and the web <Player> renders the identical component for live preview.
 */
export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  words,
  styleId,
  font,
  color,
  avatarPosition,
  position,
}) => {
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const meta = EFFECTS[styleId] ?? EFFECTS.karaoke;
  const family = resolveFamily(font);
  // Captions read big and centred; 1.2× boost over the per-style scale (the auto-fit below still
  // caps it to the column width so nothing overflows).
  const baseSize = Math.max(meta.minSize, Math.round(height * meta.fontScale * 0.9));
  // Auto-fit: shrink the font so the LONGEST word fits the caption column — this prevents both
  // overflow and mid-word breaks (esp. in the narrow "side" layout). Never below a readable floor.
  const boxW = captionBoxWidth({ width });
  const cw = CHAR_W[family] ?? 0.58;
  const longest = Math.max(1, ...(words ?? []).map((w) => w.text.trim().length));
  const fitSize = boxW / (longest * cw);
  const fontSize = Math.max(28, Math.min(baseSize, Math.floor(fitSize)));
  const pages = buildPages(words ?? [], meta.perChunk, fps, durationInFrames);
  const box = captionBox({ width, height, avatarPosition, position });
  const Effect = meta.Component;

  return (
    <AbsoluteFill>
      {pages.map((page, i) => (
        <Sequence key={i} from={page.startFrame} durationInFrames={page.durationInFrames}>
          <div style={box}>
            <Effect page={page} font={family} color={color} fontSize={fontSize} fps={fps} />
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
