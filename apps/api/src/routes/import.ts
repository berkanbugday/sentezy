import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writePromoScript } from "../lib/copywrite";
import { ingestRemoteAsset } from "../lib/r2";
import { scrapeProduct } from "../lib/scrape";

const ImportBody = z.object({ url: z.string().url() });

export async function importRoutes(app: FastifyInstance) {
  /**
   * Paste-a-product-link → promo-ready payload. Scrapes the page, pulls its photos/videos
   * into R2, and writes a Turkish promo voiceover script. The web composer pre-fills itself
   * from the result; nothing is queued here (the user reviews, then hits "Video oluştur").
   */
  app.post("/import-product", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = ImportBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_url" });
    const { url } = parsed.data;

    let product;
    try {
      product = await scrapeProduct(url);
    } catch {
      return reply.code(502).send({ error: "scrape_failed" });
    }
    if (!product.title && product.imageUrls.length === 0) {
      return reply.code(422).send({ error: "no_product_found" });
    }

    // Ingest gallery (images + short videos) into R2 in parallel, best-effort — a broken
    // asset drops out rather than failing the whole import.
    const ingested = await Promise.all([
      ...product.imageUrls.map((u) => ingestRemoteAsset(u, "image")),
      ...product.videoUrls.map((u) => ingestRemoteAsset(u, "video")),
    ]);
    const media = ingested.filter((m): m is NonNullable<typeof m> => m !== null);
    if (media.length === 0) return reply.code(422).send({ error: "no_media_found" });

    // Write the promo copy from the product details + the images we successfully pulled.
    const script = await writePromoScript(
      { title: product.title, price: product.price, description: product.description },
      media.filter((m) => m.kind === "image").map((m) => m.url),
    );

    return {
      product: { sourceUrl: url, title: product.title, price: product.price, description: product.description },
      media, // [{ ref, url, kind }]
      script,
    };
  });
}
