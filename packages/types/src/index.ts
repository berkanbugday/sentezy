import { z } from "zod";

/**
 * Shared contracts for Sentezy — imported by the web app and the API (TypeScript),
 * and mirrored by the Python worker. Keep this in sync with the Supabase schema
 * (Phase 1) and the queue design (Redis Streams).
 */

// ── Domain enums ──────────────────────────────────────────────────────────
export const VideoStatus = z.enum(["draft", "queued", "processing", "ready", "failed"]);
export type VideoStatus = z.infer<typeof VideoStatus>;

export const VideoStage = z.enum(["tts", "avatar", "compose", "thumbnail", "done"]);
export type VideoStage = z.infer<typeof VideoStage>;

export const AspectRatio = z.enum(["9:16", "1:1", "16:9"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

// ── Captions ────────────────────────────────────────────────────────────────
// CANONICAL caption-style registry — the single source of truth for the 20 effects.
// Consumed by: the web catalog (apps/web/src/lib/captionStyles.ts → CAPTION_FAMILIES),
// the Remotion renderer/preview (packages/remotion → effect components keyed by id),
// and the worker (validates the id; libass fallback still handles the first 10 ids).
// `accent` = the effect uses the accent colour (false ⇒ colour picker hidden, white-only).
// The first 10 ids are back-compat with old drafts + the worker's _CAPTION_STYLES keys.
export const CAPTION_STYLE_META = [
  { id: "clean", label: "Clean", accent: false },
  { id: "karaoke", label: "Karaoke", accent: true },
  { id: "tiktok", label: "TikTok", accent: true },
  { id: "hormozi", label: "Hormozi", accent: true },
  { id: "beast", label: "Beast", accent: true },
  { id: "boxed", label: "Boxed", accent: false },
  { id: "keyword", label: "Keyword", accent: true },
  { id: "bubble", label: "Bubble", accent: true },
  { id: "highlight", label: "Highlight", accent: true },
  { id: "typewriter", label: "Typewriter", accent: false },
  { id: "spring", label: "Spring", accent: true },
  { id: "gradient", label: "Gradient", accent: true },
  { id: "blurin", label: "Blur in", accent: true },
  { id: "highlighter", label: "Highlighter", accent: true },
  { id: "boxreveal", label: "Box reveal", accent: true },
  { id: "rainbow", label: "Rainbow", accent: false },
  { id: "emoji", label: "Emoji", accent: true },
  { id: "bounce", label: "Bounce", accent: true },
  { id: "wave", label: "Wave", accent: true },
  { id: "glow", label: "Neon", accent: true },
] as const;

export type CaptionStyleId = (typeof CAPTION_STYLE_META)[number]["id"];
export const CAPTION_STYLE_IDS = CAPTION_STYLE_META.map((s) => s.id) as unknown as [
  CaptionStyleId,
  ...CaptionStyleId[],
];
export const CaptionStyle = z.enum(CAPTION_STYLE_IDS);
export type CaptionStyle = z.infer<typeof CaptionStyle>;

// ── B-roll transitions & entrance effects ──────────────────────────────────
// CANONICAL curated set — the single source of truth for the per-clip B-roll effect.
// Rendered natively by Remotion (packages/remotion/src/broll): `transition` kinds are
// between-clip transitions (@remotion/transitions), `entrance` kinds are per-clip entrance
// animations. The web picker shows real Remotion previews keyed by id; the ffmpeg fallback
// engine maps these ids to xfade names. Stored per-clip in ReelOptions.background.media[].transition.
export const BROLL_EFFECT_META = [
  { id: "fade", label: "Fade", kind: "transition" },
  { id: "slide", label: "Slide", kind: "transition" },
  { id: "wipe", label: "Wipe", kind: "transition" },
  { id: "flip", label: "Flip", kind: "transition" },
  { id: "clockwipe", label: "Clock", kind: "transition" },
  { id: "iris", label: "Iris", kind: "transition" },
  { id: "zoom", label: "Zoom", kind: "transition" },
  { id: "blur", label: "Blur", kind: "transition" },
  { id: "push", label: "Push", kind: "transition" },
  { id: "zoompunch", label: "Zoom punch", kind: "entrance" },
  { id: "shake", label: "Shake", kind: "entrance" },
  { id: "glitch", label: "Glitch", kind: "entrance" },
  { id: "whip", label: "Savurma", kind: "entrance" },
  { id: "flash", label: "Flash", kind: "entrance" },
] as const;

export type BrollEffectId = (typeof BROLL_EFFECT_META)[number]["id"];
export const BROLL_EFFECT_IDS = BROLL_EFFECT_META.map((e) => e.id) as unknown as [
  BrollEffectId,
  ...BrollEffectId[],
];
/** ids whose effect is a per-clip entrance animation (vs a between-clip transition). */
export const BROLL_ENTRANCE_IDS = BROLL_EFFECT_META.filter((e) => e.kind === "entrance").map((e) => e.id);

// CANONICAL slide-transition SFX — the sound played at each B-roll slide, matched to the
// transition's character (one per B-roll cut). Values are file
// stems vendored (real MIT-licensed @remotion/sfx sounds) at:
//   apps/web/public/sfx/transitions/{stem}.wav   (preview <Player>)
//   apps/worker/sfx/transitions/{stem}.wav        (ffmpeg render)
// Consumed by the worker (compose_reel) and the web preview (sfxPreview.slideSfxCues).
export const BROLL_SFX_MAP: Record<BrollEffectId, string> = {
  fade: "swoosh",
  slide: "shutter-modern", // modern camera-shutter click on every slide (Berkan 2026‑07‑18)
  wipe: "page-turn",
  flip: "whip",
  clockwipe: "switch",
  iris: "swoosh",
  zoom: "swoosh",
  blur: "swoosh",
  push: "switch",
  zoompunch: "whip",
  shake: "whip",
  glitch: "switch",
  whip: "whip",
  flash: "shutter-modern",
};
/** Distinct sound stems referenced by BROLL_SFX_MAP (the files that must exist). */
export const BROLL_SFX_STEMS = Array.from(new Set(Object.values(BROLL_SFX_MAP)));
/** The slide-transition sound stem for a B-roll effect id (falls back to the swoosh). */
export function brollSfxStem(transition: string | null | undefined): string {
  return (transition && BROLL_SFX_MAP[transition as BrollEffectId]) || "swoosh";
}

const CaptionsObject = z.object({
  enabled: z.boolean().default(true),
  style: CaptionStyle.default("karaoke"),
  font: z.string().default("General Sans"),
  // Accent hex for the highlighted word (hormozi) or the karaoke primary.
  // null = the style's own default (karaoke: white, hormozi: #FFD54A yellow).
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .default(null),
});
// BACK-COMPAT: old drafts store `captions: boolean` — true/false ⇒ {enabled},
// zod defaults fill the rest. Output is always the object shape.
export const CaptionsOptions = z.preprocess(
  (v) => (typeof v === "boolean" ? { enabled: v } : v),
  CaptionsObject,
);
export type CaptionsOptions = z.infer<typeof CaptionsOptions>;

// ── Reel layout ─────────────────────────────────────────────────────────────
/** Where the cut-out avatar sits in the frame. "center" is bottom-centred (B-roll fills a
 *  top band); "left"/"right" frame it to that edge over full-frame B-roll. Replaces the old
 *  avatarLayout("side"|"bottom") + avatarSide("left"|"right") pair. */
export const AvatarPosition = z.enum(["left", "center", "right"]);
export type AvatarPosition = z.infer<typeof AvatarPosition>;

/** Read the avatar position out of a stored `options.layout` blob. Drafts written before
 *  2026-07-19 carry `avatarLayout` + `avatarSide` instead, so map those forward:
 *  bottom → center, otherwise the stored side. */
export function readAvatarPosition(layout: unknown): AvatarPosition {
  const l = (layout ?? {}) as Record<string, unknown>;
  const direct = AvatarPosition.safeParse(l.avatarPosition);
  if (direct.success) return direct.data;
  if (l.avatarLayout === "bottom") return "center";
  // Legacy mapping (faithful): a stored avatarSide describes how this specific video
  // already renders — preserve it exactly, this is not a default.
  if (l.avatarSide === "left" || l.avatarSide === "right") return l.avatarSide;
  // No usable layout data at all (missing/malformed) → the actual product default.
  return "left";
}

// ── Brand kit ───────────────────────────────────────────────────────────────
/** How an upload is framed inside the 9:16 reel.
 *
 *  `x`/`y` are a 0..1 focal point applied as CSS `object-position`, which is what makes
 *  this work without knowing the media's pixel dimensions: the browser clamps panning to
 *  whatever overflow the source actually has. `scale` is zoom, >= 1 — below 1 would expose
 *  bars at the edges, which is the letterboxing this framing exists to avoid. */
export const BrandCrop = z.object({
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(1).max(4).default(1),
});
export type BrandCrop = z.infer<typeof BrandCrop>;

/** Centred, unzoomed — what an upload gets until the user drags it. */
export const DEFAULT_BRAND_CROP: BrandCrop = { x: 0.5, y: 0.5, scale: 1 };

/** An uploaded intro/outro clip: the R2 key, its measured duration, and its framing. */
export const BrandClip = z.object({
  ref: z.string().min(1),
  ms: z.number().int().positive(),
  // Absent on clips saved before cropping existed — they were centred and unzoomed.
  crop: BrandCrop.default(DEFAULT_BRAND_CROP),
});
export type BrandClip = z.infer<typeof BrandClip>;


/** A FROZEN copy of the user's BrandKit row, taken when branding is switched on for a
 *  video. The video deliberately does not reference the live kit: re-rendering a reel
 *  from six months ago must reproduce the branding it shipped with, not whatever the
 *  user's logo happens to be today. */
export const BrandSnapshot = z.object({
  brandName: z.string().nullable().default(null),
  handle: z.string().nullable().default(null),
  logoImageId: z.string().nullable().default(null), // R2 object key
  // Rendered as the intro/outro card background, so it must be a real 6-digit hex —
  // this string goes straight into a CSS colour.
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#0A0A0B"),
  font: z.string().default("General Sans"),
  outroCta: z.string().nullable().default(null),
  // An uploaded clip overriding the generated card. `ms` is measured in the browser at
  // upload time and must be a positive integer: it shifts the voiceover for the entire
  // reel, so a zero, negative or fractional value would desynchronise the audio.
  introClip: BrandClip.nullable().default(null),
  outroClip: BrandClip.nullable().default(null),
});
export type BrandSnapshot = z.infer<typeof BrandSnapshot>;

export const BrandingOptions = z.object({
  intro: z.boolean().default(false),
  outro: z.boolean().default(false),
  watermark: z.boolean().default(false),
  /** null = branding was never applied to this video. */
  kit: BrandSnapshot.nullable().default(null),
  /** BACK-COMPAT: `branding` shipped as a placeholder carrying only this key, and no code
   *  ever read or wrote it. Preserved so an old draft still parses; superseded by `kit`. */
  logoImageId: z.string().nullable().default(null),
});
export type BrandingOptions = z.infer<typeof BrandingOptions>;

// ── Reel composition options (stored on videos.options jsonb) ──────────────
export const ReelOptions = z.object({
  background: z
    .object({
      // MVP: solid color or image(s).
      type: z.enum(["color", "image"]).default("color"),
      value: z.string().default("#0B0B0D"), // hex color, or the first R2 image key for `image`
      // Multiple R2 image keys → slideshow background (first == value). Legacy;
      // superseded by `media` when present, but kept for back-compat with older drafts.
      images: z.array(z.string()).optional(),
      // Per-photo transition effect (xfade name or "cut"), aligned to `images` order.
      transitions: z.array(z.string()).optional(),
      // Unified ordered B-roll: images AND video clips, each with its own entrance
      // transition. `ref` is an R2 object key for both kinds.
      media: z
        .array(
          z.object({
            kind: z.enum(["image", "video"]),
            ref: z.string(),
            transition: z.string().optional(),
          }),
        )
        .optional(),
    })
    .default({ type: "color", value: "#0B0B0D" }),
  captions: CaptionsOptions.default(true), // boolean default runs through the preprocess
  branding: BrandingOptions.default({
    intro: false,
    outro: false,
    watermark: false,
    kit: null,
    logoImageId: null,
  }),
  music: z
    .object({
      trackKey: z.string().nullable().default(null), // R2 key (audio)
      volume: z.number().min(0).max(1).default(0.15),
    })
    .default({ trackKey: null, volume: 0.15 }),
  // Reel layout: where the cut-out avatar sits, and whether captions ride the top
  // or the bottom band. The preprocess folds legacy avatarLayout/avatarSide blobs
  // forward; the inner object then strips those keys.
  layout: z
    .preprocess(
      (v) =>
        v && typeof v === "object" ? { ...(v as object), avatarPosition: readAvatarPosition(v) } : v,
      z.object({
        avatarPosition: AvatarPosition.default("left"),
        captionPosition: z.enum(["top", "bottom"]).default("top"),
      }),
    )
    .default({ avatarPosition: "left", captionPosition: "top" }),
  // Voice delivery — an ElevenLabs v3 audio tag setting the emotional tone
  // ("" = natural). Prepended to the script; drives both the voice and (audio-driven)
  // the HeyGen Avatar IV face.
  voice: z
    .object({
      emotion: z.string().default(""),
    })
    .default({ emotion: "" }),
  // Energy effects — whoosh SFX on photo transitions.
  effects: z
    .object({
      transitionSfx: z.boolean().default(true),
    })
    .default({ transitionSfx: true }),
  // Which wizard step the draft was last left on, so it can be resumed.
  wizardStep: z.number().int().min(0).max(4).optional(),
  // Provenance when the reel was seeded from a pasted product link (POST /import-product).
  // Purely informational — carried through so the video record remembers its source.
  product: z
    .object({
      sourceUrl: z.string(),
      title: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
  // Set by PATCH /videos/:id/title when the user explicitly renames a video — wins over the
  // product title in videoDisplayTitle from then on. Written straight to Prisma by that route
  // (bypassing this schema), but must survive a round trip through it (e.g. a later draft
  // PATCH /videos/:id) or the flag would silently strip and the display would revert.
  titleOverridden: z.boolean().optional(),
});
export type ReelOptions = z.infer<typeof ReelOptions>;

// ── API request contracts ─────────────────────────────────────────────────
export const CreateVideoRequest = z.object({
  title: z.string().min(1).max(120),
  script: z.string().min(1).max(5000),
  avatarId: z.string().uuid(),
  voiceId: z.string().uuid(),
  aspectRatio: AspectRatio.default("9:16"),
  options: ReelOptions.default({}),
});
export type CreateVideoRequest = z.infer<typeof CreateVideoRequest>;

// Draft: created early and saved progressively as the user moves through the
// wizard. All fields optional — a draft can be incomplete. Finalizing (debit +
// enqueue) happens later via POST /videos/:id/generate.
export const CreateVideoDraft = z.object({
  title: z.string().max(120).optional(),
  script: z.string().max(5000).optional(),
});
export type CreateVideoDraft = z.infer<typeof CreateVideoDraft>;

export const UpdateVideoDraft = z.object({
  title: z.string().max(120).optional(),
  script: z.string().max(5000).optional(),
  avatarId: z.string().uuid().nullable().optional(),
  voiceId: z.string().uuid().nullable().optional(),
  aspectRatio: AspectRatio.optional(),
  options: ReelOptions.optional(),
});
export type UpdateVideoDraft = z.infer<typeof UpdateVideoDraft>;

// ── Redis Streams job payload (API → worker) ──────────────────────────────
export const VideoJob = z.object({
  videoId: z.string().uuid(),
  userId: z.string().uuid(),
  attempt: z.number().int().nonnegative().default(0),
});
export type VideoJob = z.infer<typeof VideoJob>;

/** Redis Stream key + consumer group. The worker (Python) uses the same literals. */
export const REDIS_STREAM = "sentezy:videos" as const;
export const REDIS_GROUP = "worker" as const;
