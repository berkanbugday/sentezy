/** The reel wall.
 *
 *  Each card holds a <video preload="none"> whose real URL sits in data-src, so nothing is
 *  fetched until the wall is near the viewport — the page costs four posters until then.
 *  In view: load once, play muted, loop. Out of view: pause, so four videos are never
 *  decoding behind the reader's back.
 *
 *  Click toggles sound, and only one reel is ever audible: turning one on mutes the rest.
 *  Under reduced motion nothing autoplays; the posters stand until a card is clicked, which
 *  then plays it with sound, because a click is a request.
 */
const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-reel]"));
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const videoOf = (card: HTMLElement) => card.querySelector("video") as HTMLVideoElement;

/** Sets the real src the first time it is needed. Doing it here rather than in the markup is
 *  what keeps the video off the critical path. */
function load(video: HTMLVideoElement) {
  if (!video.src && video.dataset.src) video.src = video.dataset.src;
}

if (cards.length) {
  if (!reduce) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const card = e.target as HTMLElement;
          const video = videoOf(card);
          if (e.isIntersecting) {
            load(video);
            void video.play().catch(() => {
              /* A browser that refuses muted autoplay keeps the poster. Nothing to recover. */
            });
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    for (const card of cards) io.observe(card);
  }

  for (const card of cards) {
    card.addEventListener("click", () => {
      const video = videoOf(card);
      load(video);
      const turningOn = video.muted;

      // Only one reel is ever audible.
      for (const other of cards) {
        if (other === card) continue;
        videoOf(other).muted = true;
        other.classList.remove("loud");
      }

      video.muted = !turningOn;
      // Both hint labels ship in the markup with their own data-tr, so the class swap keeps
      // working after a language switch and no string lives outside copy.ts.
      card.classList.toggle("loud", turningOn);
      void video.play().catch(() => {});
    });
  }
}

export {};
