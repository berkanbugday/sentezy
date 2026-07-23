import { CAPTION_STYLE_IDS } from "@sentezy/types";
import { z } from "zod";

/**
 * Zod schemas for all web forms. Pair with react-hook-form via `zodResolver`.
 * Keep every form's validation here so it's consistent and reusable.
 */

export const loginSchema = z.object({
  email: z.string().min(1, "Enter your email").email("That email does not look right"),
  password: z.string().min(6, "Use at least 6 characters"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Enter your name"),
});
export type SignupValues = z.infer<typeof signupSchema>;

// ── create-reel wizard ──
export const createReelSchema = z.object({
  title: z.string().min(1, "Give it a title").max(120, "That title is too long"),
  script: z.string().min(1, "Write what the video should say").max(5000, "Keep the script under 5000 characters"),
  avatarId: z.string().uuid("Choose a presenter"),
  voiceId: z.string().uuid("Choose a voice"),
  captions: z.boolean().default(true),
  // Caption look — one of the 20 canonical effect ids (see @sentezy/types CAPTION_STYLE_META).
  captionStyle: z.enum(CAPTION_STYLE_IDS).default("karaoke"),
  // Caption font family (must be one installed in the worker image) and highlight/accent colour.
  captionFont: z.string().default("General Sans"),
  captionColor: z.string().default("#FFD54A"),
  // ElevenLabs v3 emotional tone — an audio tag ("" = natural delivery).
  voiceEmotion: z.string().default(""),
  // Ordered B-roll refs — an R2 key for either a photo or a video clip,
  // distinguished by the aligned backgroundKinds array. Empty = plain dark background.
  backgroundImageIds: z.array(z.string()).default([]),
  // "image" | "video" per B-roll item, aligned to backgroundImageIds order.
  backgroundKinds: z.array(z.string()).default([]),
  // Per-item entrance transition (xfade name, or "cut"), aligned to backgroundImageIds order.
  backgroundTransitions: z.array(z.string()).default([]),
  // R2 key of the background music bed, or undefined for none.
  musicTrackKey: z.string().optional(),
  // Music bed level (0..1 of full scale; UI caps at 0.4 so the bed never buries the voice).
  musicVolume: z.number().min(0).max(1).default(0.15),
  // Where the cut-out avatar sits: an edge, or bottom-centred.
  avatarPosition: z.enum(["left", "center", "right"]).default("left"),
  captionPosition: z.enum(["top", "bottom"]).default("top"),
  // Energy effects — whoosh SFX on photo transitions.
  transitionSfx: z.boolean().default(true),
});
export type CreateReelValues = z.infer<typeof createReelSchema>;

// name for the "add avatar" mini-form
export const avatarNameSchema = z.object({
  name: z.string().min(1, "Enter a name").max(80),
});
export type AvatarNameValues = z.infer<typeof avatarNameSchema>;
