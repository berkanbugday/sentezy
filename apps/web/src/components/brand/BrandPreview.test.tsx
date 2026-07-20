import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Next builds JSX with the automatic runtime, so app components correctly do not import
// React. Bare `tsx` uses the classic runtime instead, which expects `React` in module
// scope — so put it on the global before loading the component. Test-harness detail only;
// it says nothing about how the component runs in the app.
(globalThis as { React?: typeof React }).React = React;
const { BrandPreview } = await import("./BrandPreview");

/** Server-render the preview and inspect the markup. Catches the failures a typecheck
 *  cannot: a bad import, a crash on empty state, or the contrast rule not being applied. */
const render = (p: Partial<React.ComponentProps<typeof BrandPreview>> = {}) =>
  renderToStaticMarkup(
    React.createElement(BrandPreview, {
      color: "#0A0A0B",
      font: "General Sans",
      brandName: "Sentezy",
      handle: "@sentezy",
      outroCta: "Hemen dene",
      logoUrl: null,
      ...p,
    }),
  );

// Content shows up.
const dark = render();
assert.ok(dark.includes("Sentezy"), "brand name renders");
assert.ok(dark.includes("@sentezy"), "handle renders");
assert.ok(dark.includes("Hemen dene"), "CTA renders");
assert.ok(dark.includes("background-color:#0A0A0B"), "brand colour is applied");

// Contrast: white text on a dark brand, ink text on a light one. This is the rule that
// silently ruins a card if it regresses — the text simply becomes invisible.
assert.ok(dark.includes("color:#ffffff"), "dark brand gets white text");
const light = render({ color: "#FFFF00" });
assert.ok(light.includes("color:#0a0a0b"), "light brand gets ink text");

// Empty state: a brand-new kit has nothing filled in and must still render a prompt
// rather than an empty box or a crash.
const empty = render({ brandName: "", handle: "", outroCta: "", logoUrl: null });
assert.ok(empty.includes("Marka adı ekle"), "empty kit shows the prompt");
assert.ok(!empty.includes("@sentezy"));

// With a logo, the image appears in both the card and the watermark mock. Counted as
// `src="…"` rather than bare occurrences: React 19 also emits a <link rel="preload"> for
// the image, so a naive substring count sees three.
const withLogo = render({ logoUrl: "https://r2.example/logo.png" });
assert.strictEqual(
  withLogo.split('src="https://r2.example/logo.png"').length - 1,
  2,
  "logo in card + watermark",
);

// The watermark placeholder only shows when there is no logo.
assert.ok(render({ logoUrl: null }).includes("border-dashed"));
assert.ok(!withLogo.includes("border-dashed"));

console.log("apps/web/src/components/brand/BrandPreview.test.tsx ok");
