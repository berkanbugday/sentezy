"use client";

import { type ReactNode } from "react";
import type { UserInfo } from "@/lib/user";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

/** App chrome: desktop sidebar rail + a mobile bottom dock, wrapped around the
 *  floating content panel. */
export function AppShell({ user, children }: { user: UserInfo; children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden [background:var(--frame)]">
      {/* desktop rail */}
      <Sidebar user={user} />

      {/* inset floating workspace: symmetric gutter on mobile, sidebar-hugging on desktop */}
      <div className="min-w-0 flex-1 p-2.5 md:py-2.5 md:pl-0 md:pr-2.5">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-hairline bg-paper">
          <main className="no-scrollbar flex-1 overflow-y-auto px-5 pb-28 pt-6 sm:px-6 md:px-8 md:pb-12">{children}</main>
        </div>
      </div>

      {/* mobile bottom dock */}
      <BottomNav user={user} />
    </div>
  );
}
