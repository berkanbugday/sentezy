"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useIdentity, useProfile } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { UserInfo } from "@/lib/user";
import { Icon } from "./icons";

const DOCK = [
  { href: "/dashboard", label: "Ana sayfa", icon: Icon.home, ready: true },
  { href: "/library", label: "Videolar", icon: Icon.video, ready: true },
  { href: "/avatars", label: "Avatar", icon: Icon.users, ready: true },
  // Short label deliberately: five slots plus "Daha" is the most this dock fits at
  // 360px, and "Marka Kiti" would wrap.
  { href: "/brand-kit", label: "Marka", icon: Icon.box, ready: true },
];

/** Mobile bottom dock. Primary nav with a Material-style oval highlight behind the
 *  active icon; the "…" item opens a slide-up sheet (search + account + sign out). */
export function BottomNav({ user: authUser }: { user: UserInfo }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const credits = useProfile().data?.credits;
  // Same synced identity as the sidebar, so the account sheet shows the saved name.
  const user = useIdentity(authUser);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex w-full max-w-md items-stretch gap-1 rounded-full border border-white/10 bg-[#14141a]/95 p-1.5 px-3 shadow-2xl backdrop-blur">
          {DOCK.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            const inner = (
              <>
                <span className={`flex h-7 w-[54px] items-center justify-center rounded-full transition ${active ? "bg-white/16 text-white" : "text-white/55"}`}>
                  <n.icon width={20} height={20} />
                </span>
                <span className={`text-[10px] font-medium leading-none ${active ? "text-white" : "text-white/55"}`}>{n.label}</span>
              </>
            );
            const cls = "flex flex-1 flex-col items-center gap-1 py-1";
            return n.ready ? (
              <Link key={n.href} href={n.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={n.href} disabled className={`${cls} !cursor-not-allowed`}>
                {inner}
              </button>
            );
          })}
          {/* more → bottom sheet */}
          <button onClick={() => setSheet(true)} className="flex flex-1 flex-col items-center gap-1 py-1">
            <span className={`flex h-7 w-[54px] items-center justify-center rounded-full transition ${sheet ? "bg-white/16 text-white" : "text-white/55"}`}>
              <Icon.more width={20} height={20} />
            </span>
            <span className={`text-[10px] font-medium leading-none ${sheet ? "text-white" : "text-white/55"}`}>Daha</span>
          </button>
        </div>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Kapat" onClick={() => setSheet(false)} className="absolute inset-0 bg-black/50" />
          <div className="sheet-in absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-hairline bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
            <div className="flex items-center gap-3 px-1 pb-3">
              <span className="grad flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[14px] font-bold text-white">{user.initials}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-ink">{user.name}</div>
                <div className="truncate text-[12px] text-muted">{user.email}</div>
              </div>
              <span className="flex flex-none items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-ink">
                <Icon.bolt width={13} height={13} className="text-slate" />
                {credits ?? "—"} <span className="text-muted">kredi</span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 border-t border-hairline pt-2">
              <Link href="/settings" onClick={() => setSheet(false)} className="nav-item">
                <Icon.settings width={18} height={18} />
                Ayarlar
              </Link>
              <button className="nav-item">
                <Icon.help width={18} height={18} />
                Help
              </button>
              <button onClick={signOut} className="nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
