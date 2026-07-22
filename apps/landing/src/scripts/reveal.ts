/** Scroll reveals, sticky-nav shadow, and the FAQ accordion. Under reduced motion every
 *  reveal is applied immediately instead of being observed. */
const q = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s));
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const nav = document.querySelector(".nav");
const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 20);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (reduce) {
  q(".reveal,.stagger").forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver(
    (es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );
  q(".reveal,.stagger").forEach((el) => io.observe(el));
}

q(".faq-q").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".faq-item")?.classList.toggle("open"));
});

export {};
