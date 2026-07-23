/** Drives every phone in the platform section.
 *
 *  A demo is `[data-demo]` holding `[data-slide]`s and the same number of `[data-chip]`s;
 *  exactly one of each carries `.on`. Each row runs on its own interval so the four phones
 *  drift out of sync — four demos flipping in lockstep reads as one animation, not four
 *  independent choices.
 *
 *  Clicking a chip takes the row over for good: the auto-advance stops rather than yanking
 *  the slide away from someone who just picked one. Under reduced motion nothing advances on
 *  its own, and the chips are the only way through — which is a working demo, not a dead one.
 */
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

for (const demo of Array.from(document.querySelectorAll<HTMLElement>("[data-demo]"))) {
  const slides = Array.from(demo.querySelectorAll<HTMLElement>("[data-slide]"));
  const chips = Array.from(demo.querySelectorAll<HTMLElement>("[data-chip]"));
  if (slides.length < 2) continue;

  let i = 0;
  const show = (n: number) => {
    slides[i]?.classList.remove("on");
    chips[i]?.classList.remove("on");
    chips[i]?.setAttribute("aria-pressed", "false");
    i = n;
    slides[i]?.classList.add("on");
    chips[i]?.classList.add("on");
    chips[i]?.setAttribute("aria-pressed", "true");
  };

  let timer = 0;
  chips.forEach((chip, n) =>
    chip.addEventListener("click", () => {
      if (timer) { clearInterval(timer); timer = 0; }
      demo.classList.add("manual"); // stops the chip's countdown bar
      show(n);
    }),
  );

  if (!reduce) {
    const every = Number(demo.dataset.interval) || 2400;
    timer = window.setInterval(() => show((i + 1) % slides.length), every);
  }
}

export {};
