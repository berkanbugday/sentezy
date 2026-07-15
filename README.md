# Sentezy

Create short‑form **reels featuring an AI avatar**. Give a script, pick a avatar photo and a
voice — Sentezy generates a finished vertical (9:16) reel with the avatar speaking, auto captions,
branding, and music.

## Monorepo layout

| Path | Stack | Deploys to |
|------|-------|-----------|
| `apps/landing` | Astro | Cloudflare Pages |
| `apps/web` | Next.js | Railway (Docker) |
| `apps/api` | Fastify (TS) | Railway |
| `apps/worker` | Python (uv) | Railway |
| `packages/types` | shared TS contracts + zod + generated DB types | — |
| `packages/config` | shared tsconfig / prettier | — |
| `supabase/` | Postgres migrations, auth, RLS | Supabase |
| `infra/` | Dockerfiles, deploy config, local docker-compose | — |

**Services:** Supabase (db/auth/realtime) · Cloudflare R2 (media) · Redis Streams on Railway (queue)
· ElevenLabs (TTS) · HeyGen (talking photo).

## Pipeline

`script + avatar + voice` → ElevenLabs TTS → HeyGen talking photo (audio‑driven) → Python/ffmpeg
compose (9:16 + background + captions + branding + music) + thumbnail → R2 → realtime progress in web.

## Getting started

```bash
corepack enable            # provides pnpm
pnpm install               # install JS workspaces
cp .env.example .env       # fill in secrets
pnpm dev                   # run apps via Turborepo
```

The Python worker (`apps/worker`) is managed with `uv` and is not part of the pnpm workspace — see
`apps/worker/README.md` (Phase 3).

See the full build plan for architecture and the phased sequence.
