"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserInfo } from "@/lib/user";
import { Icon } from "./icons";
import { TeamSwitcher } from "./TeamSwitcher";
import { Tooltip } from "./Tooltip";

const NAV = [
  { href: "/dashboard", label: "Ana sayfa", icon: Icon.home, ready: true },
  { href: "/library", label: "Videolarım", icon: Icon.video, ready: true },
  { href: "/avatars", label: "Avatarlar", icon: Icon.users, ready: false },
  { href: "/search", label: "Ara", icon: Icon.search, ready: false },
];

const STORAGE_KEY = "sentezy:sidebar-collapsed";

/** `mobile` renders the sidebar as an in-drawer panel (always expanded, opaque);
 *  `onNavigate` fires when a nav link is tapped so the drawer can close. */
export function Sidebar({ user, mobile = false, onNavigate }: { user: UserInfo; mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted state after mount (avoids a hydration mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  // The drawer is always fully expanded; collapse only applies to the desktop rail.
  const isCollapsed = mobile ? false : collapsed;

  const asideCls = mobile
    ? "dark no-scrollbar flex h-full w-[264px] flex-none flex-col gap-1 overflow-y-auto overflow-x-hidden p-3 [background:var(--frame)]"
    : `dark no-scrollbar hidden h-screen flex-none flex-col gap-1 overflow-y-auto overflow-x-hidden p-3 transition-[width] duration-200 md:flex ${
        collapsed ? "w-[74px]" : "w-[248px]"
      }`;

  return (
    <aside className={asideCls}>
      {/* brand + collapse/close toggle */}
      <div className={`flex items-center pb-2 pt-1 ${isCollapsed ? "justify-center" : "gap-2 px-1"}`}>
        <Tooltip label="Sentezy" disabled={!isCollapsed}>
          <Image src="/sentezy-mark-light.png" alt="Sentezy" width={26} height={26} className="h-[26px] w-[26px] flex-none" />
        </Tooltip>
        {!isCollapsed && <span className="disp flex-1 text-[19px] font-bold tracking-tight text-white">Sentezy</span>}
        {mobile ? (
          <button onClick={onNavigate} aria-label="Menüyü kapat" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            <Icon.close width={18} height={18} />
          </button>
        ) : (
          !collapsed && (
            <Tooltip label="Menüyü daralt">
              <button onClick={toggle} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
                <Icon.panelLeft width={18} height={18} />
              </button>
            </Tooltip>
          )
        )}
      </div>
      {!mobile && collapsed && (
        <Tooltip label="Menüyü genişlet">
          <button onClick={toggle} className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            <Icon.panelLeft width={18} height={18} />
          </button>
        </Tooltip>
      )}

      {/* workspace switcher */}
      <div className="mb-1">
        <TeamSwitcher user={user} collapsed={isCollapsed} />
      </div>

      {/* primary nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          const content = (
            <>
              <n.icon className="flex-none" />
              {!isCollapsed && <span>{n.label}</span>}
              {!isCollapsed && !n.ready && (
                <span className="ml-auto rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
                  yakında
                </span>
              )}
            </>
          );
          const title = n.ready ? n.label : `${n.label} — yakında`;
          const cls = `nav-item ${isCollapsed ? "justify-center" : ""}`;
          const item = n.ready ? (
            <Link href={n.href} onClick={onNavigate} className={cls} data-active={active ? "true" : "false"}>
              {content}
            </Link>
          ) : (
            <span className={`${cls} cursor-default`}>{content}</span>
          );
          return (
            <Tooltip key={n.href} label={title} disabled={!isCollapsed && n.ready}>
              {item}
            </Tooltip>
          );
        })}
      </nav>

      {/* footer: credits + help (pinned) */}
      <div className={`mt-auto flex ${isCollapsed ? "flex-col items-center gap-2" : "items-center gap-2 px-1"}`}>
        <Tooltip label="50 kredi kaldı">
          <span
            className={`flex items-center gap-1.5 rounded-full border border-white/20 text-[13px] font-semibold text-white ${
              isCollapsed ? "h-9 w-9 justify-center" : "px-3 py-1.5"
            }`}
          >
            <Icon.bolt width={14} height={14} className="text-white/80" />
            {!isCollapsed && (
              <>
                50 <span className="text-white/60">kredi</span>
              </>
            )}
          </span>
        </Tooltip>
        <Tooltip label="Yardım & destek">
          <button
            className={`flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white ${isCollapsed ? "" : "ml-auto"}`}
          >
            <Icon.help width={18} height={18} />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
