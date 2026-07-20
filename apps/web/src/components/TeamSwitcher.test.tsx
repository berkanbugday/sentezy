import assert from "node:assert";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// See SettingsView.test.tsx for why React goes on the global and how to run this file.
(globalThis as { React?: typeof React }).React = React;
const { TeamSwitcher } = await import("./TeamSwitcher");
const { qk } = await import("@/lib/queries");

const noop = () => {};
const stubRouter = { push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop } as never;

/** Render the expanded switcher with the profile query seeded (or absent), so the synced
 *  identity can be observed in the markup. */
function render(profile: Record<string, unknown> | undefined): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (profile) qc.setQueryData(qk.profile, profile);
  const authUser = { name: "Berkan", email: "berkan.bugday92@gmail.com", initials: "BE" };
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: stubRouter },
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(TeamSwitcher, { user: authUser }),
      ),
    ),
  );
}

// THE BUG THIS FIXES: the sidebar showed the auth-derived "Berkan / BE" while the settings
// screen showed the saved "Berkan Buğday / BB". With the profile loaded, the switcher must
// show the profile's name and its initials, not the auth fallback.
const synced = render({ displayName: "Berkan Buğday", email: "berkan.bugday92@gmail.com", plan: "free", credits: 25 });
assert.ok(synced.includes("Berkan Buğday"), "shows the saved display name");
assert.ok(synced.includes(">BB<"), "initials follow the saved name, not the auth email");
assert.ok(!synced.includes(">BE<"), "the stale auth initials are gone");

// Before the profile loads (or if it has no name), fall back to the auth identity rather
// than rendering blank.
const fallback = render(undefined);
assert.ok(fallback.includes("Berkan") && fallback.includes(">BE<"), "auth identity is the fallback");

// A profile with an empty name also falls back — an empty string is not a chosen name.
const emptyName = render({ displayName: "", email: "x@y.co", plan: "free", credits: 1 });
assert.ok(emptyName.includes(">BE<"), "blank display name falls back to auth initials");

console.log("apps/web/src/components/TeamSwitcher.test.tsx ok");
