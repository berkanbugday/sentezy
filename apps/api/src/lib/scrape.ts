import * as cheerio from "cheerio";
import { env } from "../env";
import { safeFetch } from "./ssrf";

/**
 * Scrape a product page into the bits we need to build a promo video: title, price,
 * description, and the product's photos/videos. Hybrid strategy:
 *   1. In-house — fetch the raw HTML and parse it (JSON-LD schema.org Product first,
 *      then OpenGraph, then a light gallery sweep). Free, works on most e-commerce.
 *   2. Fallback — when the in-house result is "thin" (no title, or no media), and a
 *      FIRECRAWL_API_KEY is set, re-fetch a *rendered* HTML via Firecrawl (handles
 *      JS-rendered / bot-blocked pages) and run the SAME parser over it.
 */

export interface ScrapedProduct {
  title: string;
  price?: string;
  description?: string;
  imageUrls: string[];
  videoUrls: string[];
}

const MAX_IMAGES = 6;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** A result is worth returning only if we found a title AND at least one image. */
function isRich(p: ScrapedProduct): boolean {
  return Boolean(p.title) && p.imageUrls.length > 0;
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const html = await fetchHtml(url);
  let product = html ? parseHtml(html, url) : emptyProduct();

  // Thin result → try the managed renderer (if configured) and re-parse.
  if (!isRich(product) && env.FIRECRAWL_API_KEY) {
    const rendered = await firecrawlHtml(url);
    if (rendered) {
      const viaFirecrawl = parseHtml(rendered, url);
      // Prefer whichever pass is richer (Firecrawl usually wins on JS-rendered pages).
      if (isRich(viaFirecrawl) || viaFirecrawl.imageUrls.length > product.imageUrls.length) {
        product = viaFirecrawl;
      }
    }
  }
  return product;
}

const emptyProduct = (): ScrapedProduct => ({ title: "", imageUrls: [], videoUrls: [] });

async function fetchHtml(url: string): Promise<string | null> {
  try {
    // safeFetch blocks SSRF (private/loopback/link-local targets) on the URL and every redirect hop.
    const res = await safeFetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "tr,en;q=0.8", Accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** POST to Firecrawl's scrape endpoint and return the rendered HTML, or null. */
async function firecrawlHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { data?: { html?: string } } | null;
    return json?.data?.html ?? null;
  } catch {
    return null;
  }
}

// ── HTML → ScrapedProduct ────────────────────────────────────────────────────

export function parseHtml(html: string, baseUrl: string): ScrapedProduct {
  const $ = cheerio.load(html);
  const ld = extractJsonLdProduct($);

  const title = firstText([ld?.name, $('meta[property="og:title"]').attr("content"), $("title").first().text()]);
  const description = firstText([
    ld?.description,
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
  ]);
  const price = firstText([ld?.price, $('meta[property="product:price:amount"]').attr("content")]);

  // Images: JSON-LD image[] first (curated product shots), then OpenGraph images.
  const imageCandidates = [
    ...toArray(ld?.image),
    ...$('meta[property="og:image"], meta[property="og:image:url"], meta[name="og:image"]')
      .map((_, el) => $(el).attr("content"))
      .get(),
  ];
  const imageUrls = dedupeAbsolute(imageCandidates, baseUrl).slice(0, MAX_IMAGES);

  // Videos: OpenGraph video + JSON-LD video + inline <video><source>.
  const videoCandidates = [
    ...toArray(ld?.video),
    ...$('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]')
      .map((_, el) => $(el).attr("content"))
      .get(),
    ...$("video source[src], video[src]")
      .map((_, el) => $(el).attr("src"))
      .get(),
  ];
  const videoUrls = dedupeAbsolute(videoCandidates, baseUrl).slice(0, 2);

  return { title, description: description || undefined, price: price || undefined, imageUrls, videoUrls };
}

interface LdProduct {
  name?: string;
  description?: string;
  price?: string;
  image?: unknown;
  video?: unknown;
}

/** Find the first schema.org Product node across all <script type="application/ld+json"> blocks. */
function extractJsonLdProduct($: cheerio.CheerioAPI): LdProduct | null {
  const blocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).contents().text())
    .get();

  for (const raw of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    // A block may be a single node, an array, or an @graph container.
    const nodes = flattenLd(data);
    const product = nodes.find((n) => isProductType(n));
    if (product) {
      const offers = firstOf((product as Record<string, unknown>).offers);
      const amount = str(offers?.price) ?? str(offers?.lowPrice);
      return {
        name: str((product as Record<string, unknown>).name),
        description: str((product as Record<string, unknown>).description),
        price: formatPrice(amount, str(offers?.priceCurrency)),
        image: (product as Record<string, unknown>).image,
        video: (product as Record<string, unknown>).video,
      };
    }
  }
  return null;
}

function flattenLd(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.flatMap(flattenLd);
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const graph = obj["@graph"];
    if (Array.isArray(graph)) return graph.flatMap(flattenLd);
    return [obj];
  }
  return [];
}

function isProductType(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.toLowerCase() === "product");
}

// ── small helpers ─────────────────────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

const CURRENCY_SYMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };

/** "499.9" + "TRY" → "499.9 ₺" (falls back to the bare amount, or the code if unknown). */
function formatPrice(amount?: string, currency?: string): string | undefined {
  if (!amount) return undefined;
  if (!currency) return amount;
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? currency;
  return `${amount} ${sym}`;
}

/** offers can be an object, an array of offers, or absent. */
function firstOf(v: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(v)) return v[0] as Record<string, unknown> | undefined;
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return undefined;
}

/** schema.org image/video can be a string, an ImageObject, or an array of either. */
function toArray(v: unknown): string[] {
  if (!v) return [];
  const list = Array.isArray(v) ? v : [v];
  return list
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? str((x as Record<string, unknown>).url) ?? str((x as Record<string, unknown>).contentUrl) : undefined))
    .filter((x): x is string => Boolean(x));
}

const firstText = (candidates: Array<string | undefined | null>): string =>
  (candidates.find((c) => c && c.trim()) ?? "").trim();

/** Resolve to absolute URLs, drop data URIs, and de-duplicate preserving order. */
function dedupeAbsolute(urls: Array<string | undefined>, baseUrl: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || u.startsWith("data:")) continue;
    let abs: string;
    try {
      abs = new URL(u, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}
