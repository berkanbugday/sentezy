import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Next builds JSX with the automatic runtime, so app components correctly do not import
// React. Bare `tsx` uses the classic runtime instead, which expects `React` in module
// scope — so put it on the global before loading the component. Test-harness detail only;
// it says nothing about how the component runs in the app.
(globalThis as { React?: typeof React }).React = React;
const { BrandPreview } = await import("./BrandPreview");

/** Server-render the preview and inspect the markup. Catches what a typecheck cannot:
 *  a crash on empty state, or the contrast rule silently not being applied. */
const render = (p: Partial<React.ComponentProps<typeof BrandPreview>> = {}) =>
  renderToStaticMarkup(
    React.createElement(BrandPreview, {
      mode: "intro" as const,
      color: "#0A0A0B",
      font: "General Sans",
      brandName: "Sentezy",
      handle: "@sentezy",
      outroCta: "Hemen dene",
      logoUrl: null,
      ...p,
    }),
  );

// ── The card ────────────────────────────────────────────────────────────────
const intro = render();
assert.ok(intro.includes("Sentezy"), "brand name renders");
assert.ok(intro.includes("@sentezy"), "handle renders");
assert.ok(intro.includes("background-color:#0A0A0B"), "brand colour is the card background");
// The CTA belongs to the outro only — it is the closing action, not an opener.
assert.ok(!intro.includes("Hemen dene"), "intro shows no CTA");
assert.ok(render({ mode: "outro" }).includes("Hemen dene"), "outro shows the CTA");

// Contrast: the rule that silently ruins a card if it regresses — the text just vanishes.
assert.ok(intro.includes("color:#ffffff"), "dark brand gets white text");
assert.ok(render({ color: "#FFFF00" }).includes("color:#0a0a0b"), "light brand gets ink text");

// Empty state: a brand-new kit must prompt rather than render an empty coloured box.
const empty = render({ brandName: "", handle: "", outroCta: "", logoUrl: null });
assert.ok(empty.includes("Add a logo or a brand name"));
assert.ok(!empty.includes("@sentezy"));
// ...and the prompt disappears as soon as there is anything to show.
assert.ok(!render({ brandName: "", logoUrl: "https://r2/l.png" }).includes("Add a logo or a brand name"));

// ── Watermark ───────────────────────────────────────────────────────────────
// The watermark sits over the reel, so its frame is the reel's dark backdrop, NOT the
// brand colour — showing it on the brand colour would misrepresent where the logo lands.
const wm = render({ mode: "watermark", color: "#FF5A1F", logoUrl: "https://r2/l.png" });
assert.ok(wm.includes("background-color:#0b0b0d"), "watermark previews over the reel backdrop");
assert.ok(!wm.includes("background-color:#FF5A1F"));
assert.strictEqual(wm.split('src="https://r2/l.png"').length - 1, 1, "one logo, in the corner");
// With no logo there is nothing to stamp, so the slot is shown as an outline.
assert.ok(render({ mode: "watermark", logoUrl: null }).includes("border-dashed"));

console.log("apps/web/src/components/brand/BrandPreview.test.tsx ok");
