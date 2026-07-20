// packages/remotion/src/reel/types.ts
import type { CaptionStyleId } from "@sentezy/types";
import type { AvatarPosition, CaptionPosition, CaptionWord } from "../types";
import type { ResolvedSfxCue } from "./SfxTrack";
import type { ReelBrollItem } from "./BrollLayer";
import type { ReelBrand } from "../brand/types";

/** Props for the single Reel composition — passed verbatim by the web <Player> (preview)
 *  and by the Cloudflare renderer as Remotion inputProps (render). Width/height/fps come
 *  from the composition config via calculateMetadata, mirrored here for calculateMetadata. */
export type ReelProps = {
  words: CaptionWord[];
  /** Still-image URL (browser preview) or matte .mov URL (render). */
  avatarUrl: string | null;
  broll: ReelBrollItem[];
  captionStyle: { styleId: CaptionStyleId; font: string; color: string };
  avatarPosition: AvatarPosition;
  position: CaptionPosition;
  captions: boolean;
  /** True only in the web <Player> — mounts audible SfxTrack. The render is opaque + silent. */
  previewAudio: boolean;
  sfxCues: ResolvedSfxCue[];
  /** Preview-only background bed (a signed R2 URL). null = no music. */
  musicUrl: string | null;
  /** 0..1 bed level, matched to options.music.volume. */
  musicVolume: number;
  /** Brand kit for this video — intro/outro ends and the watermark. null/omitted = none,
   *  in which case the reel is exactly what it was before the feature existed. */
  brand?: ReelBrand | null;
  width?: number;
  height?: number;
  fps?: number;
};
