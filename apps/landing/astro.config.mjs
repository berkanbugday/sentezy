import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Landing → Cloudflare Pages (static). Tailwind v4 via the Vite plugin.
// English at /, Turkish at /tr/. prefixDefaultLocale stays false so the English tree keeps
// its bare URLs — every existing inbound link and share card still resolves.
export default defineConfig({
  site: "https://sentezy.com",
  // "never": getRelativeLocaleUrl() and friends must keep emitting the same bare URLs the
  // hardcoded links used before Task 6 (e.g. /terms, not /terms/) — the default ("ignore" +
  // the "directory" build format) appends a trailing slash to every computed link, which
  // would silently reshape every internal href even though the page it targets is unchanged.
  trailingSlash: "never",
  i18n: {
    locales: ["en", "tr"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
