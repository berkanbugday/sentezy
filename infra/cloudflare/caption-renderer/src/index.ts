import { Container, getContainer } from "@cloudflare/containers";

// Cloudflare Worker: the orchestration layer. Remotion cannot run in a Worker isolate
// (no Chromium/child processes), so we forward POST /render to a Cloudflare Container that
// runs Node + Chromium + FFmpeg (container/server.mjs). The container renders the transparent
// caption overlay and uploads it to R2; we relay its JSON response ({ overlayKey }) back.

export interface Env {
  CAPTION_RENDERER: DurableObjectNamespace<CaptionRenderer>;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
}

export class CaptionRenderer extends Container<Env> {
  defaultPort = 8080; // matches EXPOSE / server.mjs PORT
  sleepAfter = "5m"; // scale to zero after 5 min idle (no charge while asleep)

  // R2 credentials handed to the container process (server.mjs reads them from process.env).
  // Set as Worker secrets: `wrangler secret put R2_ACCESS_KEY_ID` etc.
  envVars = {
    R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: this.env.R2_BUCKET,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    // /render = transparent caption overlay — forwarded to the warm container
    // (the Remotion bundle stays cached across renders).
    if (request.method === "POST" && url.pathname === "/render") {
      // For higher throughput, shard by `getContainer(env.CAPTION_RENDERER, jobId)`.
      const container = getContainer(env.CAPTION_RENDERER);
      return container.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
