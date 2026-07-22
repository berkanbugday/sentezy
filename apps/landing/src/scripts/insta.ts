/** Instagram's embed.js is heavy third-party JS that blocks nothing we need above the fold, so
 *  it is injected only when the showcase approaches the viewport.
 *
 *  Until then each slot holds a skeleton at the typical reel-embed height. We cannot know the
 *  real height in advance — Instagram sizes the iframe itself, and a longer caption makes it
 *  taller — so this reduces the reflow rather than eliminating it. The section is below the
 *  fold and loads on approach, so any residual shift lands off-screen. */
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
