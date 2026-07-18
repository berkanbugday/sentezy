# Sentezy reel / caption renderer (Cloudflare)

Renders `@sentezy/remotion` compositions with Node + Chromium + FFmpeg and stores the output in R2.
Two routes:

- **`POST /render`** → the **CaptionOverlay** composition → a **transparent ProRes 4444 `.mov`**
  (caption-only overlay engine; worker composites it like the matted avatar). Used when
  `CAPTION_ENGINE=remotion`.
- **`POST /render-reel`** → the **Reel** full-compositor composition (avatar + B-roll + captions +
  motion graphics) → an **opaque H.264 `.mp4`** (video only). Used when `RENDER_ENGINE=remotion`;
  the worker then muxes the audio bed (voice + ducked music + SFX) onto it with FFmpeg.

```
worker (POST /render) ─▶ Worker (src/index.ts) ─▶ Container (container/server.mjs)
                                                     Node + Chromium + FFmpeg + Remotion bundle
                                                     renderMedia → prores 4444 (yuva444p10le, ALPHA)
                                                     upload ─▶ R2  overlays/{jobId}.mov
                         ◀───────────────── { overlayKey } ◀──────────────────┘
```

Not in the pnpm workspace — it deploys independently to **your** Cloudflare account.

## Request contract (what the worker sends)

`POST /render` → `{ overlayKey: "overlays/{jobId}.mov" }`

```jsonc
{
  "jobId": "uuid",
  "words": [{ "text": "Merhaba", "start": 0.0, "end": 0.4 }, ...], // seconds
  "styleId": "highlight",   // one of the 20 ids in @sentezy/types CAPTION_STYLE_META
  "font": "Poppins",
  "color": "#FFD54A",
  "width": 1080, "height": 1920, "fps": 30,
  "layout": "bottom",       // "side" | "bottom"
  "position": "bottom",     // "top" | "bottom"
  "avatarSide": "right"     // "left" | "right"
}
```

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

In local docker-compose (no R2 creds) both routes stream the rendered file back inline instead of
returning a key — the Python client branches on the response `content-type`.

## Deploy (requires a Cloudflare account with Containers enabled)

Cloudflare **Containers** went GA on 2026‑04‑13 and require a **paid Workers plan**.

1. `cd infra/cloudflare/caption-renderer && npm install`
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
   CAPTION_ENGINE=remotion
   CAPTION_RENDERER_URL=https://sentezy-caption-renderer.<subdomain>.workers.dev
   ```
   (worker reads these in `apps/worker/sentezy_worker/config.py`.)

## Verify

- `curl https://<worker-url>/health` → `ok`
- `curl -X POST https://<worker-url>/render -H 'content-type: application/json' -d @sample.json`
  → `{ "overlayKey": "overlays/…​.mov" }`, and the object appears in R2.
- `ffprobe` the object → `pix_fmt=yuva444p10le` (alpha present). Overlay it on any clip with
  `ffmpeg -i bg.mp4 -i overlay.mov -filter_complex "[0][1]overlay=0:0:format=auto" out.mp4`.
- End-to-end: run a worker job with `CAPTION_ENGINE=remotion` and confirm the reel shows the style.

## Notes

- **Alpha is non-negotiable:** `renderMedia` sets `proResProfile: "4444"` **and**
  `pixelFormat: "yuva444p10le"`. Without the explicit pixel format Remotion emits opaque 422.
- **Chromium:** the image installs apt `chromium` and sets `REMOTION_CHROME_EXECUTABLE_PATH=/usr/bin/chromium`
  + `REMOTION_SKIP_DOWNLOAD_BROWSER=1`. `PUPPETEER_EXECUTABLE_PATH` does **not** work with Remotion.
- **Warm bundle:** `server.mjs` bundles the Remotion project once and reuses the `serveUrl` — never
  re-bundle per request.
- **Cost/licence:** container compute ≈ $0.01–0.05 per render (R2 egress is free). Remotion needs a
  commercial licence at 4+ people (Automators $0.01/render, $100/mo floor). Arrange before production.
- **Scale-up (later):** for high concurrency, shard containers by `getContainer(ns, jobId)` or adopt the
  Queues + Durable Objects chunk/stitch pattern from the official `remotion-dev/cloudflare-containers-demo`.
