/** One accessor per data file. Components call these with `Astro.currentLocale`, which Astro
 *  derives from the URL — so no prop drilling, and /tr/ pages render Turkish at build time. */
import { getRelativeLocaleUrl } from "astro:i18n";
import type { Copy, Locale, Reels, Studio } from "./types";
import { copy as copyEn } from "./copy.en";
import { copy as copyTr } from "./copy.tr";
import { studio as studioEn } from "./studio.en";
import { studio as studioTr } from "./studio.tr";
import { reels as reelsEn } from "./reels.en";
import { reels as reelsTr } from "./reels.tr";

const COPY: Record<Locale, Copy> = { en: copyEn, tr: copyTr };
const STUDIO: Record<Locale, Studio> = { en: studioEn, tr: studioTr };
const REELS: Record<Locale, Reels> = { en: reelsEn, tr: reelsTr };

/** Astro.currentLocale is `string | undefined`; anything unexpected falls back to English
 *  rather than throwing, because a wrong language is recoverable and a blank page is not. */
export const localeOf = (v?: string): Locale => (v === "tr" ? "tr" : "en");

export const getCopy = (v?: string): Copy => COPY[localeOf(v)];
export const getStudio = (v?: string): Studio => STUDIO[localeOf(v)];
export const getReels = (v?: string): Reels => REELS[localeOf(v)];

/** Locale-aware internal href.
 *
 *  Wraps getRelativeLocaleUrl for two reasons. First, it takes the raw
 *  `Astro.currentLocale` (string | undefined) and narrows it through localeOf, so no call site
 *  repeats the `=== "tr"` comparison. Second, getRelativeLocaleUrl returns "/tr/" for a locale
 *  root regardless of trailingSlash: "never" — Cloudflare Pages 308s that to "/tr", so the
 *  slash costs a redirect hop on every logo click. Strip it, except on "/" itself. */
export const localeHref = (v: string | undefined, p: string): string => {
  const u = getRelativeLocaleUrl(localeOf(v), p);
  return u.length > 1 ? u.replace(/\/$/, "") : u;
};

/** The current path with any /tr prefix stripped, so a locale switch lands on the counterpart
 *  of THIS page rather than on the home page.
 *
 *  The `(?=\/|$)` lookahead matters: it matches the /tr segment only when a slash or the end
 *  of the path follows, so a future /trends route is left alone. */
export const barePath = (pathname: string): string =>
  pathname.replace(/^\/tr(?=\/|$)/, "") || "/";
