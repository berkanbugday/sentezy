import { z } from "zod";

// In dev, the root .env is loaded by dotenv-cli (see package.json `dev`).
// In prod (Railway), these come from the platform environment.
const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional(), // HS256 fallback for token verification
  SUPABASE_DB_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  // Empty string ⇒ treat as unset (fall back to presigned download URLs).
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal("")),

  // Only the worker needs these; optional here so the API can boot without them.
  ELEVENLABS_API_KEY: z.string().optional(),
  HEYGEN_API_KEY: z.string().optional(),

  // Scenario-step "add emotion" vision pass (lib/emotion.ts). OpenRouter is
  // OpenAI-compatible; the model must accept image_url input. Empty key = button no-ops.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_VISION_MODEL: z
    .string()
    .default("google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,google/gemini-2.5-flash"),
  // Text-only "suggest sound effects" pass (lib/sfx.ts). Comma-separated free-model
  // fallback chain (free models 429 often). Empty OPENROUTER_API_KEY = endpoint no-ops.
  OPENROUTER_SFX_MODEL: z
    .string()
    .default("google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,google/gemini-2.5-flash"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;

// Dev mode (NODE_ENV=development|dev) relaxes limits meant for prod — notably the
// credit gate on video generation — so local end-to-end runs never hit "insufficient
// credits". Prod-safe: anything other than development/dev is treated as production.
export const isDev = ["development", "dev"].includes(env.NODE_ENV.toLowerCase());
