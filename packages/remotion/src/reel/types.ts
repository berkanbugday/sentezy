// packages/remotion/src/reel/types.ts
import type { CaptionStyleId } from "@sentezy/types";
import type { AvatarSide, CaptionLayout, CaptionPosition, CaptionWord } from "../types";
import type { ResolvedSfxCue } from "./SfxTrack";
import type { ReelBrollItem } from "./BrollLayer";

/** Props for the single Reel composition — passed verbatim by the web <Player> (preview)
 *  and by the Cloudflare renderer as Remotion inputProps (render). Width/height/fps come
 *  from the composition config via calculateMetadata, mirrored here for calculateMetadata. */
export type ReelProps = {
  words: CaptionWord[];
  /** Still-image URL (browser preview) or matte .mov URL (render). */
  avatarUrl: string | null;
  broll: ReelBrollItem[];
  captionStyle: { styleId: CaptionStyleId; font: string; color: string };
  layout: CaptionLayout;
  position: CaptionPosition;
  avatarSide: AvatarSide;
  captions: boolean;
  /** True only in the web <Player> — mounts audible SfxTrack. The render is opaque + silent. */
  previewAudio: boolean;
  sfxCues: ResolvedSfxCue[];
  width?: number;
  height?: number;
  fps?: number;
};
