import { env } from "../env";

/**
 * Turn scraped product data into a short Turkish promo VOICEOVER script for the reel.
 * Multimodal: the product text PLUS its photos are sent to a vision model so the copy can
 * reference what the product actually looks like. Mirrors lib/emotion.ts (OpenRouter,
 * OpenAI-compatible, comma-separated free-model fallback chain, 429/5xx retry). On total
 * failure it returns a simple template built from the title/price so import never dead-ends.
 */

export interface ProductCopyInput {
  title: string;
  price?: string;
  description?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST to OpenRouter for ONE model with a couple of retries. Returns the text, or null. */
async function callModel(key: string, model: string, messages: unknown): Promise<string | null> {
  for (const wait of [0, 1500]) {
    if (wait) await sleep(wait);
    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sentezy.app",
          "X-Title": "Sentezy",
        },
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 500 }),
      });
    } catch {
      continue; // network error → retry
    }
    if (res.status === 429 || res.status >= 500) continue; // transient → retry
    if (!res.ok) return null; // terminal client error
    const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
    return (json?.choices?.[0]?.message?.content ?? "").trim();
  }
  return null;
}

const SYSTEM = [
  "You are a Turkish social-media ad copywriter. You write the SPOKEN voiceover script for a",
  "short (15-25 second) vertical product promo video. You are shown the product's details and",
  "its photos.",
  "STRICT RULES:",
  "1. Write ONLY the Turkish voiceover text — no title, no preamble, no scene directions, no quotes.",
  "2. Natural spoken sentences a narrator would say out loud. 2-4 short sentences, ~35-60 words total.",
  "3. Open with a hook, highlight what makes the product appealing (look, feel, use), end with a",
  "   light call to action (e.g. 'hemen keşfet', 'şimdi incele'). Mention the price only if it helps.",
  "4. NO hashtags, NO emojis, NO markdown, NO bullet points, NO URLs.",
  "5. Turkish output regardless of the product-page language.",
].join("\n");

/** Compose the ~15-25s Turkish promo script. Empty key / all-models-fail → template fallback. */
export async function writePromoScript(product: ProductCopyInput, imageUrls: string[]): Promise<string> {
  const key = env.OPENROUTER_API_KEY;
  const fallback = templateScript(product);
  if (!key || !product.title) return fallback;

  const details = [
    `Ürün: ${product.title}`,
    product.price ? `Fiyat: ${product.price}` : "",
    product.description ? `Açıklama: ${product.description.slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `${details}\n\nBu ürün için kısa bir tanıtım seslendirme metni yaz.` },
    // A vision model reads the product shots; a text-only model just ignores these parts.
    ...imageUrls.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url } })),
  ];
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content },
  ];

  const models = env.OPENROUTER_VISION_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
  for (const model of models) {
    const out = await callModel(key, model, messages);
    if (out && out.length >= 15) return cleanup(out);
  }
  return fallback;
}

/** Strip any stray markdown/quote wrapping a model sometimes adds around the script. */
function cleanup(text: string): string {
  return text
    .replace(/^```[a-z]*\n?|```$/gi, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
}

/** Deterministic fallback so import still yields an editable script with no LLM. */
function templateScript(product: ProductCopyInput): string {
  const name = product.title || "Bu ürün";
  const price = product.price ? ` Üstelik sadece ${product.price}.` : "";
  return `${name} ile tarzını bir üst seviyeye taşı.${price} Kaliteyi ve şıklığı bir arada sunan bu ürünü hemen keşfet.`;
}
