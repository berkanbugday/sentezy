import type { FastifyInstance } from "fastify";

// MVP backgrounds: solid colors + (later) curated Cloudflare Images presets.
// Premium monochrome background options (dark → light neutral grays).
const COLORS = ["#0A0A0B", "#18181B", "#3F3F46", "#71717A", "#D4D4D8", "#FFFFFF"];

export async function backgroundRoutes(app: FastifyInstance) {
  app.get("/backgrounds", async () => {
    return {
      colors: COLORS,
      images: [] as Array<{ id: string; label: string }>,
    };
  });
}
