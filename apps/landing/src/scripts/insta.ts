/** Instagram's embed.js is ~40 KB of third-party JS that blocks nothing we need above the
 *  fold, so it is injected only when the showcase approaches the viewport. Until then each
 *  slot shows a skeleton sized to the embed's aspect, so nothing reflows when it lands. */
declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const section = document.querySelector("#showcase");

const load = () => {
  if (document.querySelector('script[data-insta-embed]')) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.instagram.com/embed.js";
  s.setAttribute("data-insta-embed", "");
  // embed.js auto-processes on load, but call it explicitly in case it was already cached.
  s.addEventListener("load", () => window.instgrm?.Embeds.process());
  document.body.appendChild(s);
  section?.classList.add("embeds-loading");
};

if (section) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        load();
        io.disconnect();
      }
    },
    { rootMargin: "400px 0px" },
  );
  io.observe(section);
}

export {};
