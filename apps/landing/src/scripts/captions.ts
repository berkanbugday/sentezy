/** Cycles the caption demo through its styles. Each style is a .cap-demo-slide; exactly one
 *  carries .on at a time, and the chip at the same index lights with it. Frozen on the first
 *  slide under reduced motion — the markup already ships with slide 0 and chip 0 lit, so
 *  doing nothing is the correct frozen state. */
const slides = Array.from(document.querySelectorAll<HTMLElement>(".cap-demo-slide"));
const chips = Array.from(document.querySelectorAll<HTMLElement>(".cap-chip"));

if (slides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove("on");
    chips[i]?.classList.remove("on");
    i = (i + 1) % slides.length;
    slides[i].classList.add("on");
    chips[i]?.classList.add("on");
  }, 2200);
}

export {};
