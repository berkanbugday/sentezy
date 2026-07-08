import type { FastifyInstance } from "fastify";

// MVP backgrounds: solid colors + (later) curated Cloudflare Images presets.
const COLORS = ["#0B0B0D", "#F5F4F1", "#7C86E8", "#111827", "#1E293B", "#FDF2F8"];

export async function backgroundRoutes(app: FastifyInstance) {
  app.get("/backgrounds", async () => {
    return {
      colors: COLORS,
      images: [] as Array<{ id: string; label: string }>,
    };
  });
}
