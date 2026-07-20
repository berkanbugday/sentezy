// RUN: TSX_TSCONFIG_PATH=/Users/berkan/Projects/sentezy/apps/web/tsconfig.json \
//        pnpm --filter @sentezy/api exec tsx <abs path to this file>
// The `@/` alias needs the web tsconfig; without TSX_TSCONFIG_PATH tsx uses api's and the
// alias fails to resolve. (Other test files avoid this by using only relative imports, but
// this one pulls in the real component, which is aliased throughout.)
import assert from "node:assert";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// tsx uses the classic JSX runtime; app components (built by Next's automatic runtime)
// don't import React, so put it on the global before loading them. Harness detail only.
(globalThis as { React?: typeof React }).React = React;
const { SettingsView } = await import("./SettingsView");
const { qk } = await import("@/lib/queries");

/** Render SettingsView with the profile query pre-seeded, so useQuery resolves without a
 *  network call. Exercises the real card layout, plan label and credit display — the parts
 *  a typecheck cannot see. */
function render(profile: Record<string, unknown>): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(qk.profile, profile);
  return renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client: qc }, React.createElement(SettingsView)),
  );
}

// ── A free user with a name ───────────────────────────────────────────────────
const free = render({ displayName: "Berkan Buğday", email: "berkan@x.co", plan: "free", credits: 25 });
assert.ok(free.includes("Ayarlar"), "heading renders");
assert.ok(free.includes("Berkan Buğday"), "display name shows");
assert.ok(free.includes("berkan@x.co"), "email shows");
assert.ok(free.includes("Ücretsiz plan"), "free plan label");
assert.ok(free.includes("25"), "real credit count");
assert.ok(free.includes("MAX"), "a free user is offered the upgrade");
// Initials come from the display name, not the email.
assert.ok(free.includes(">BB<"), "avatar shows initials of the name");

// ── A user with no name falls back to the email ────────────────────────────────
const noName = render({ displayName: null, email: "ada@x.co", plan: "free", credits: 3 });
assert.ok(noName.includes("ada@x.co"), "email stands in for a missing name");
assert.ok(noName.includes("3"), "low credit count still shows");

// ── A MAX user is NOT shown the upgrade CTA ─────────────────────────────────────
const max = render({ displayName: "Pro", email: "pro@x.co", plan: "max", credits: 500 });
assert.ok(max.includes("MAX plan"), "max plan label");
assert.ok(!max.includes("MAX&#x27;e geç") && !max.includes("MAX'e geç"), "no upgrade CTA for a MAX user");

console.log("apps/web/src/components/SettingsView.test.tsx ok");
