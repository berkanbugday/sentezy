import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Landing → Cloudflare Pages (static). Tailwind v4 via the Vite plugin.
export default defineConfig({
  site: "https://sentezy.com",
  vite: {
    plugins: [tailwindcss()],
  },
});
