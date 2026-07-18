# Sentezy reel renderer (Cloudflare)

Renders `@sentezy/remotion` compositions with Node + Chromium + FFmpeg and stores the output in R2.
One route:

- **`POST /render-reel`** → the **Reel** full-compositor composition (avatar + B-roll + captions +
  motion graphics) → an **opaque H.264 `.mp4`** (video only). The worker then muxes the audio bed
  (voice + ducked music + SFX) onto it with FFmpeg.

```
worker (POST /render-reel) ─▶ Worker (src/index.ts) ─▶ Container (container/server.mjs)
                                                          Node + Chromium + FFmpeg + Remotion bundle
                                                          renderMedia → h264 (opaque)
                                                          upload ─▶ R2  reels/{jobId}.mp4
                            ◀───────────────── { reelKey } ◀──────────────────┘
```

Not in the pnpm workspace — it deploys independently to **your** Cloudflare account.

## Request contract (what the worker sends)

`POST /render-reel` → `{ reelKey: "reels/{jobId}.mp4" }` (opaque, video only)

```jsonc
{
  "jobId": "uuid",
  "templateId": "testimonial",  // one of @sentezy/types TEMPLATE_META
  "words": [{ "text": "Merhaba", "start": 0.0, "end": 0.4 }, ...],
  "avatarUrl": "https://…signed R2 GET… .mov",   // matted alpha avatar; "" for none
  "broll": [{ "url": "https://…signed…", "kind": "image", "start": 1.2, "end": 2.6, "transition": "fade" }],
  "theme": { "accent": "#FFD54A", "font": "General Sans", "logoUrl": null },
  "captionStyle": { "styleId": "highlight", "font": "Poppins", "color": "#FFD54A" },
  "layout": { "avatarSide": "right", "avatarLayout": "side", "captionPosition": "bottom" },
  "width": 1080, "height": 1920, "fps": 30
}
```

In local docker-compose (no R2 creds) the route streams the rendered file back inline instead of
returning a key — the Python client branches on the response `content-type`.

## Deploy (requires a Cloudflare account with Containers enabled)

Cloudflare **Containers** went GA on 2026‑04‑13 and require a **paid Workers plan**.

1. `cd infra/cloudflare/reel-renderer && npm install`
2. `npx wrangler login`
3. Point `vars.R2_BUCKET` in `wrangler.jsonc` at your bucket (default `sentezy-media`), and set
   the R2 credentials as secrets (the container uses the S3 API — R2 has no native container binding):
   ```
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   ```
4. `npx wrangler deploy` — builds the container image (Docker required locally) and deploys the Worker.
   - The Dockerfile `COPY`s `packages/remotion`, so the **image build context is the repo root**
     (`image_build_context: "../../.."` in `wrangler.jsonc`). Build for `linux/amd64`.
5. Point the worker at the deployed Worker URL:
   ```
   REEL_RENDERER_URL=https://sentezy-reel-renderer.<subdomain>.workers.dev
   ```
   (worker reads this in `apps/worker/sentezy_worker/config.py`.)

## Verify

- `curl https://<worker-url>/health` → `ok`
- `curl -X POST https://<worker-url>/render-reel -H 'content-type: application/json' -d @sample.json`
  → `{ "reelKey": "reels/…​.mp4" }`, and the object appears in R2.
- `ffprobe` the object → opaque `h264`/`yuv420p` video (no alpha — the reel is the final, muxed-by-worker mp4).
- End-to-end: run a worker job and confirm the rendered reel matches the in-browser `<Player>` preview.

## Notes

- **Opaque H.264:** `renderMedia` uses `codec: "h264"` / `imageFormat: "jpeg"` — the reel is
  video-only (no alpha); the worker muxes the audio bed on afterward with FFmpeg.
- **Chromium:** the image installs apt `chromium` and sets `REMOTION_CHROME_EXECUTABLE_PATH=/usr/bin/chromium`
  + `REMOTION_SKIP_DOWNLOAD_BROWSER=1`. `PUPPETEER_EXECUTABLE_PATH` does **not** work with Remotion.
- **Warm bundle:** `server.mjs` bundles the Remotion project once and reuses the `serveUrl` — never
  re-bundle per request.
- **Cost/licence:** container compute ≈ $0.01–0.05 per render (R2 egress is free). Remotion needs a
  commercial licence at 4+ people (Automators $0.01/render, $100/mo floor). Arrange before production.
- **Scale-up (later):** for high concurrency, shard containers by `getContainer(ns, jobId)` or adopt the
  Queues + Durable Objects chunk/stitch pattern from the official `remotion-dev/cloudflare-containers-demo`.
