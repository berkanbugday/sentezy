/** The platform section's two interactions.
 *
 *  1. Filter chips. A group is `[data-filter-group="x"]`, its items live in
 *     `[data-filter-items="x"]`, and each item declares `data-tags="women hijab"`.
 *     "all" shows everything. Items are hidden with a class, not removed, so the grid
 *     keeps its column count and nothing reflows sideways.
 *  2. The voice list plays through, one row at a time. Nothing is audible — the row's
 *     waveform only marks which line the demo is reading, so there is no play control to
 *     click and nothing that implies an audition happens here.
 *
 *  Reduced motion stops the auto-advance but leaves the filters alone: a click the visitor
 *  made is not motion the visitor needs protecting from.
 */
const groups = Array.from(document.querySelectorAll<HTMLElement>("[data-filter-group]"));

for (const group of groups) {
  const key = group.dataset.filterGroup;
  const container = document.querySelector<HTMLElement>(`[data-filter-items="${key}"]`);
  if (!container) continue;
  const chips = Array.from(group.querySelectorAll<HTMLButtonElement>("[data-filter]"));
  const items = Array.from(container.children) as HTMLElement[];

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const want = chip.dataset.filter ?? "all";
      for (const c of chips) {
        const on = c === chip;
        c.classList.toggle("on", on);
        c.setAttribute("aria-pressed", String(on));
      }
      for (const item of items) {
        const tags = (item.dataset.tags ?? "").split(" ");
        item.classList.toggle("out", want !== "all" && !tags.includes(want));
      }
    });
  }
}

const list = document.querySelector<HTMLElement>("[data-voice-list]");
if (list) {
  const rows = Array.from(list.querySelectorAll<HTMLElement>(".row"));
  let i = 0;
  const show = (n: number) => {
    rows[i]?.classList.remove("on");
    i = n;
    rows[i]?.classList.add("on");
  };

  // Clicking a row hands control over: the auto-advance stops for good rather than yanking
  // the selection away from someone who just made one.
  let timer = 0;
  rows.forEach((row, n) =>
    row.addEventListener("click", () => {
      if (timer) { clearInterval(timer); timer = 0; }
      show(n);
    }),
  );

  if (rows.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    timer = window.setInterval(() => show((i + 1) % rows.length), 2600);
  }
}

// Picking a face marks it, the way choosing a presenter does in the composer.
const faces = Array.from(document.querySelectorAll<HTMLElement>(".face"));
for (const face of faces) {
  face.addEventListener("click", () => {
    for (const f of faces) f.classList.toggle("sel", f === face);
  });
}

export {};
