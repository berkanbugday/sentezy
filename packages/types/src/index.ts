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
  { id: "clean", label: "Sade", accent: false },
  { id: "karaoke", label: "Karaoke", accent: true },
  { id: "tiktok", label: "TikTok", accent: true },
  { id: "hormozi", label: "Hormozi", accent: true },
  { id: "beast", label: "Beast", accent: true },
  { id: "boxed", label: "Kutu", accent: false },
  { id: "keyword", label: "Anahtar", accent: true },
  { id: "bubble", label: "Baloncuk", accent: true },
  { id: "highlight", label: "Vurgu", accent: true },
  { id: "typewriter", label: "Daktilo", accent: false },
  { id: "spring", label: "Zıplama", accent: true },
  { id: "gradient", label: "Degrade", accent: true },
  { id: "blurin", label: "Netleşen", accent: true },
  { id: "highlighter", label: "Fosforlu", accent: true },
  { id: "boxreveal", label: "Kutu Geçiş", accent: true },
  { id: "rainbow", label: "Gökkuşağı", accent: false },
  { id: "emoji", label: "Emoji", accent: true },
  { id: "bounce", label: "Sekme", accent: true },
  { id: "wave", label: "Dalga", accent: true },
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
  { id: "fade", label: "Solma", kind: "transition" },
  { id: "slide", label: "Kaydırma", kind: "transition" },
  { id: "wipe", label: "Silme", kind: "transition" },
  { id: "flip", label: "Çevirme", kind: "transition" },
  { id: "clockwipe", label: "Saat", kind: "transition" },
  { id: "iris", label: "İris", kind: "transition" },
  { id: "zoom", label: "Zum", kind: "transition" },
  { id: "blur", label: "Bulanık", kind: "transition" },
  { id: "push", label: "İtme", kind: "transition" },
  { id: "zoompunch", label: "Zum vuruş", kind: "entrance" },
  { id: "shake", label: "Sarsıntı", kind: "entrance" },
  { id: "glitch", label: "Glitch", kind: "entrance" },
  { id: "whip", label: "Savurma", kind: "entrance" },
  { id: "flash", label: "Parlama", kind: "entrance" },
] as const;

export type BrollEffectId = (typeof BROLL_EFFECT_META)[number]["id"];
export const BROLL_EFFECT_IDS = BROLL_EFFECT_META.map((e) => e.id) as unknown as [
  BrollEffectId,
  ...BrollEffectId[],
];
/** ids whose effect is a per-clip entrance animation (vs a between-clip transition). */
export const BROLL_ENTRANCE_IDS = BROLL_EFFECT_META.filter((e) => e.kind === "entrance").map((e) => e.id);

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
  branding: z
    .object({
      logoImageId: z.string().nullable().default(null), // R2 image key
      intro: z.boolean().default(false),
      outro: z.boolean().default(false),
    })
    .default({ logoImageId: null, intro: false, outro: false }),
  music: z
    .object({
      trackKey: z.string().nullable().default(null), // R2 key (audio)
      volume: z.number().min(0).max(1).default(0.15),
    })
    .default({ trackKey: null, volume: 0.15 }),
  // Reel layout: which side the cut-out avatar is framed to, and where the
  // captions sit (on the clear side, opposite the avatar).
  layout: z
    .object({
      // "side" = avatar framed left/right over full-frame B-roll;
      // "bottom" = avatar bottom-centred with B-roll filling a top band.
      avatarLayout: z.enum(["side", "bottom"]).default("side"),
      avatarSide: z.enum(["left", "right"]).default("right"),
      captionPosition: z.enum(["top", "bottom"]).default("bottom"),
    })
    .default({ avatarLayout: "side", avatarSide: "right", captionPosition: "bottom" }),
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
