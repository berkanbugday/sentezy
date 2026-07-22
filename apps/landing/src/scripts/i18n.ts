/** EN is authored in the markup; TR lives in data-tr. On first run we snapshot the EN
 *  text into data-en, then the switch just swaps between the two attributes. */
const q = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s));

q("[data-tr]").forEach((el) => {
  if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.textContent ?? "");
});

const swBtns = q("[data-switch]");

const setLang = (l: string) => {
  q("[data-tr]").forEach((el) => {
    el.textContent = l === "tr" ? el.getAttribute("data-tr") : el.getAttribute("data-en");
  });
  swBtns.forEach((b) => b.classList.toggle("on", b.getAttribute("data-switch") === l));
  document.documentElement.lang = l;
};

swBtns.forEach((b) => b.addEventListener("click", () => setLang(b.getAttribute("data-switch") ?? "en")));

export {};
