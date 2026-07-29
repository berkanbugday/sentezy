/** Drives the hero's app demo.
 *
 *  Sleeps between beats. An earlier version held one requestAnimationFrame loop open for the
 *  whole 15s and did almost nothing on almost every frame — which still wakes the main thread
 *  sixty times a second, on a marketing page whose entire problem is people leaving it on a
 *  phone. Now a single `setTimeout` waits for the next beat, and rAF runs only for the 2.2s the
 *  typewriter is actually drawing. Everything else the demo animates — the cursor's travel, the
 *  wipes, the spinners, the glow — is CSS, and runs on the compositor whether this file is
 *  awake or not.
 *
 *  The loop runs only while the demo is on screen and the tab is visible, and not at all under
 *  prefers-reduced-motion, where the finished state is rendered statically instead.
 */
import { beats, LOOP, TYPE_MS } from "../data/heroDemo";

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

  // ── the typewriter ───────────────────────────────────────────────────────
  // The one thing here that genuinely needs a frame loop: it draws a different string on each
  // frame for TYPE_MS and then stops. Driven from its own clock rather than the beat clock, so
  // it cannot be left half-written by a beat that fires late.
  let typeRaf = 0;
  function startTyping() {
    if (!typeEl || !script) return;
    cancelAnimationFrame(typeRaf);
    const from = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - from) / TYPE_MS);
      const n = Math.round(p * script.length);
      // Guarded: writing the same string again would still dirty the text node.
      if ((typeEl.textContent ?? "").length !== n) typeEl.textContent = script.slice(0, n);
      if (p < 1) typeRaf = requestAnimationFrame(step);
    };
    typeRaf = requestAnimationFrame(step);
  }

  // ── the beat clock ───────────────────────────────────────────────────────
  let timer = 0;
  let startedAt = 0;
  let next = 0;
  let running = false;

  /** Sleep until the next beat — or until the wrap, once the beats are spent. Times are always
   *  measured from `startedAt`, never accumulated, so a late timeout cannot make the demo drift
   *  out of step with itself. */
  function schedule() {
    const t = performance.now() - startedAt;
    const at = next < beats.length ? beats[next].at : LOOP;
    timer = window.setTimeout(next < beats.length ? fire : wrap, Math.max(0, at - t));
  }

  function fire() {
    const b = beats[next++];
    if (b.step) {
      root!.dataset.step = b.step;
      if (b.step === "typing") startTyping();
      // Only started here, never on load: preload="none" means the file is not fetched until
      // this beat, so the reel costs nothing to a visitor who leaves before it.
      if (b.step === "done") void video?.play().catch(() => {});
    }
    if (b.cursor) moveTo(b.cursor);
    if (b.click) click();
    schedule();
  }

  function wrap() {
    reset();
    next = 0;
    startedAt = performance.now();
    schedule();
  }

  function reset() {
    root!.dataset.step = "idle";
    if (typeEl) typeEl.textContent = "";
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }

  function start() {
    if (running || reduce) return;
    running = true;
    reset();
    next = 0;
    startedAt = performance.now();
    schedule();
  }

  function stop() {
    if (!running) return;
    running = false;
    window.clearTimeout(timer);
    cancelAnimationFrame(typeRaf);
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
          }
        }
      },
      { threshold: 0.25 },
    ).observe(root);

    // A backgrounded tab throttles timers to once a minute, which would strand the demo
    // mid-beat and resume it with the cursor somewhere it never travelled to. Tracking
    // `onScreen` separately matters here: without it, returning to the tab would restart a
    // demo that has since been scrolled past.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stop();
        reset();
      } else if (onScreen) start();
    });
  }
}

export {};
