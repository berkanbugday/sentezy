import type { CaptionStyleId } from "@sentezy/types";

/** A transcribed word with absolute timing in **seconds** (as produced by the
 *  worker's ElevenLabs word alignment, `Word(text, start, end)`). */
export type CaptionWord = { text: string; start: number; end: number };

/** Where the cut-out avatar sits: framed to an edge, or bottom-centred. */
export type AvatarPosition = "left" | "center" | "right";
/** Which band the captions ride. */
export type CaptionPosition = "top" | "bottom";

/** Input props for the CaptionOverlay composition — passed verbatim as Remotion
 *  `inputProps` by the Cloudflare renderer, and by the web `<Player>` for preview.
 *  Width / height / fps come from the composition config, not from props. */
export type CaptionOverlayProps = {
  words: CaptionWord[];
  styleId: CaptionStyleId;
  /** Font family name — must match a family loaded in fonts.ts. */
  font: string;
  /** Accent hex ("#RRGGBB") for the highlighted word / marker / gradient. */
  color: string;
  position: CaptionPosition;
};

/** Composition-level input: the overlay props plus render dimensions/fps that
 *  `calculateMetadata` reads to size the video. The CaptionOverlay component itself
 *  reads width/height/fps from useVideoConfig, so it ignores these extra fields. */
export type CaptionCompositionProps = CaptionOverlayProps & {
  width?: number;
  height?: number;
  fps?: number;
};

/** One caption page (a chunk of words shown together), with per-token frames
 *  **relative to the page's own Sequence** (0 = page start). */
export type PageToken = { text: string; fromFrame: number; toFrame: number };
export type CaptionPage = {
  startFrame: number;
  durationInFrames: number;
  tokens: PageToken[];
};

/** Props every effect component receives. Frames inside `page` are relative to
 *  the page Sequence, so effects read `useCurrentFrame()` in the same 0-based space. */
export type EffectProps = {
  page: CaptionPage;
  font: string;
  color: string;
  fontSize: number;
  fps: number;
};
