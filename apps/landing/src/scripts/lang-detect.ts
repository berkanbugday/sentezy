/** Sends a Turkish browser from the English tree to /tr/.
 *
 *  Inlined as the FIRST element in <head>, before the stylesheet and font links, so it runs
 *  before the browser paints — the redirect is not visible as a flash of English.
 *
 *  Emitted on English pages only, so no loop is possible: /tr/ never carries this script.
 *
 *  Order matters. A stored choice always beats the browser: someone who clicked EN on a
 *  Turkish-configured machine meant it, and re-detecting would overrule them on every visit. */
(() => {
  try {
    const saved = localStorage.getItem("sentezy-lang");
    if (saved) return; // explicit choice — including a saved "en", which means "stay here"
  } catch {
    /* Storage blocked: fall through to detection rather than failing closed. */
  }

  /* The languages array is the ordered preference list; navigator.language is only its head.
     A visitor set to [en-GB, tr] prefers English and must not be redirected. */
  const first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
  if (!/^tr\b/i.test(first)) return;

  /* On "/" the naive "/tr" + pathname yields "/tr/", which Cloudflare Pages 308s to "/tr" —
     an avoidable second hop on the most common entry path there is for a Turkish visitor.
     Same stray locale-root slash localeHref strips from links; strip it here too. */
  const path = location.pathname === "/" ? "" : location.pathname;

  /* replace(), not href: the back button must not land on a page that redirects again. */
  location.replace("/tr" + path + location.search + location.hash);
})();
