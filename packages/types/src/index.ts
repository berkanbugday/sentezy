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
export const CaptionStyle = z.enum(["karaoke", "tiktok", "beast", "hormozi", "boxed", "clean"]);
export type CaptionStyle = z.infer<typeof CaptionStyle>;

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
      // MVP: solid color or image(s). No video backgrounds.
      type: z.enum(["color", "image"]).default("color"),
      value: z.string().default("#0B0B0D"), // hex color, or the first Cloudflare Images id for `image`
      // Multiple Cloudflare Images ids → slideshow background (first == value).
      images: z.array(z.string()).optional(),
      // Per-photo transition effect (xfade name or "cut"), aligned to `images` order.
      transitions: z.array(z.string()).optional(),
    })
    .default({ type: "color", value: "#0B0B0D" }),
  captions: CaptionsOptions.default(true), // boolean default runs through the preprocess
  branding: z
    .object({
      logoImageId: z.string().nullable().default(null), // Cloudflare Images id
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
  // Reel layout: which side the cut-out presenter is framed to, and where the
  // captions sit (on the clear side, opposite the presenter).
  layout: z
    .object({
      avatarSide: z.enum(["left", "right"]).default("right"),
      captionPosition: z.enum(["top", "bottom"]).default("bottom"),
    })
    .default({ avatarSide: "right", captionPosition: "bottom" }),
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
  presenterId: z.string().uuid(),
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
  presenterId: z.string().uuid().nullable().optional(),
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
