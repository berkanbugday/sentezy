/** Drives the hero's app demo.
 *
 *  One requestAnimationFrame loop holds the clock; every beat in src/data/heroDemo.ts is a
 *  `data-step` write and a cursor move, and CSS does the rest. There is deliberately no
 *  per-beat setTimeout: a tab that throttles timers would desynchronise the cursor from the
 *  step it is supposed to be pressing, and the demo would show a click landing on nothing.
 *  Reading elapsed time from the frame's own timestamp cannot drift.
 *
 *  The loop runs only while the demo is on screen and the tab is visible, and not at all under
 *  prefers-reduced-motion — where the finished state is rendered statically instead.
 */
import { beats, LOOP, TYPE_FROM, TYPE_TO } from "../data/heroDemo";

const root = document.querySelector<HTMLElement>("[data-hd]");

if (root) {
  const cursor = root.querySelector<HTMLElement>("[data-hd-cursor]");
  const typeEl = root.querySelector<HTMLElement>("[data-hd-type]");
  const video = root.querySelector<HTMLVideoElement>("[data-hd-video]");
  /** The typed line comes from the markup, so it stays inside the i18n type check rather than
   *  being duplicated into this script. */
  const script = root.querySelector<HTMLElement>("[data-hd-script-src]")?.textContent?.trim() ?? "";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Centre of a `data-anchor` element, in the demo's own coordinate space. Measured at the
   *  moment of the move rather than cached, so a resize or a reflow between beats needs no
   *  special handling — and so an element that only just became visible still measures. */
  function moveTo(name: string) {
    if (!cursor) return;
    const el = root!.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
    if (!el) return;
    const a = el.getBoundingClientRect();
    const b = root!.getBoundingClientRect();
    if (a.width === 0 && a.height === 0) return; // no box to aim at — leave the cursor put
    cursor.style.translate = `${a.left - b.left + a.width / 2}px ${a.top - b.top + a.height / 2}px`;
  }

  let clickTimer = 0;
  function click() {
    if (!cursor) return;
    cursor.classList.remove("click");
    void cursor.offsetWidth; // restart the ripple even if two clicks land close together
    cursor.classList.add("click");
    window.clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => cursor.classList.remove("click"), 420);
  }

  function reset() {
    root!.dataset.step = "idle";
    if (typeEl) typeEl.textContent = "";
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }

  let raf = 0;
  let t0 = 0;
  let next = 0;
  let running = false;

  function frame(now: number) {
    if (!t0) t0 = now;
    const t = now - t0;

    while (next < beats.length && beats[next].at <= t) {
      const b = beats[next++];
      if (b.step) {
        root!.dataset.step = b.step;
        // Only started here, never on load: preload="none" means the file is not fetched until
        // this beat, so the reel costs nothing to a visitor who leaves before it.
        if (b.step === "done") void video?.play().catch(() => {});
      }
      if (b.cursor) moveTo(b.cursor);
      if (b.click) click();
    }

    if (typeEl && script) {
      const p = (t - TYPE_FROM) / (TYPE_TO - TYPE_FROM);
      const n = Math.round(Math.min(1, Math.max(0, p)) * script.length);
      // Guarded: writing the same string every frame would still dirty the text node.
      if ((typeEl.textContent ?? "").length !== n) typeEl.textContent = script.slice(0, n);
    }

    if (t >= LOOP) {
      reset();
      next = 0;
      t0 = now;
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduce) return;
    running = true;
    t0 = 0; // re-based on the next frame, so time spent off screen is not counted
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    video?.pause();
  }

  if (reduce) {
    // No cursor, no typing, no autoplay — the finished state, held. The four labels under the
    // stage all render lit in this mode, so the story is still told, just not sequenced.
    root.dataset.step = "done";
    root.dataset.reduce = "1";
    if (typeEl) typeEl.textContent = script;
  } else {
    // Restarting from the top each time it comes back into view is deliberate: someone
    // scrolling back up wants the demo from the beginning, not from beat nine.
    let onScreen = false;
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          onScreen = e.isIntersecting;
          if (onScreen) start();
          else {
            stop();
            reset();
            next = 0;
          }
        }
      },
      { threshold: 0.25 },
    ).observe(root);

    // A backgrounded tab throttles rAF to a crawl rather than stopping it, which would leave
    // the loop mid-beat and resume with the cursor somewhere it never travelled to. Tracking
    // `onScreen` separately matters here: without it, returning to the tab would restart a
    // demo that has since been scrolled past.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stop();
        reset();
        next = 0;
      } else if (onScreen) start();
    });
  }
}

export {};
