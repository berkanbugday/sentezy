import { Container, getContainer } from "@cloudflare/containers";

// Cloudflare Worker: forwards POST /render-reel to a Cloudflare Container running
// Node + Chromium + FFmpeg (container/server.mjs), which renders the @sentezy/remotion
// `Reel` composition to an opaque H.264 .mp4 and uploads it to R2 ({ reelKey }).

export interface Env {
  REEL_RENDERER: DurableObjectNamespace<ReelRenderer>;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
}

export class ReelRenderer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
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
    if (request.method === "POST" && url.pathname === "/render-reel") {
      const container = getContainer(env.REEL_RENDERER);
      return container.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
