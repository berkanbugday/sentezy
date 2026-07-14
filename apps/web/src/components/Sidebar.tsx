"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserInfo } from "@/lib/user";
import { Icon } from "./icons";
import { UserMenu } from "./UserMenu";

const NAV = [
  { href: "/dashboard", label: "Ana sayfa", icon: Icon.home, ready: true },
  { href: "/library", label: "Videolarım", icon: Icon.video, ready: true },
  { href: "/avatars", label: "Avatarlar", icon: Icon.users, ready: false },
  { href: "/templates", label: "Şablonlar", icon: Icon.grid, ready: false },
  { href: "/brand", label: "Marka kiti", icon: Icon.box, ready: false },
];

const STORAGE_KEY = "sentezy:sidebar-collapsed";

export function Sidebar({ user }: { user: UserInfo }) {
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

  return (
    <aside
      className={`hidden h-screen flex-none flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-hairline bg-paper p-4 transition-[width] duration-200 md:flex ${
        collapsed ? "w-[76px]" : "w-[264px]"
      }`}
    >
      <div className={`flex items-center pb-3 pt-1 ${collapsed ? "justify-center" : "gap-2 px-2"}`}>
        <Image src="/sentezy-logo.png" alt="Sentezy" width={28} height={28} className="h-7 w-7 flex-none" />
        {!collapsed && <span className="disp text-[21px] font-bold tracking-tight text-ink">Sentezy</span>}
      </div>

      <button
        onClick={toggle}
        title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
        className={`nav-item ${collapsed ? "justify-center" : ""}`}
      >
        <Icon.chevronLeft className={`flex-none transition-transform ${collapsed ? "rotate-180" : ""}`} />
        {!collapsed && <span>Daralt</span>}
      </button>

      <Link
        href="/create"
        title="Yeni video"
        className={`btn btn-primary w-full ${collapsed ? "!px-0" : ""}`}
      >
        <Icon.plus width={18} height={18} className="flex-none" />
        {!collapsed && "Yeni video"}
      </Link>

      <nav className="mt-4 flex flex-col gap-0.5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          const content = (
            <>
              <n.icon className="flex-none" />
              {!collapsed && <span>{n.label}</span>}
              {!collapsed && !n.ready && <span className="ml-auto text-[10px] text-muted">yakında</span>}
            </>
          );
          const cls = `nav-item ${collapsed ? "justify-center" : ""}`;
          return n.ready ? (
            <Link key={n.href} href={n.href} title={n.label} className={cls} data-active={active ? "true" : "false"}>
              {content}
            </Link>
          ) : (
            <span key={n.href} title={n.label} className={`${cls} cursor-default opacity-70`}>
              {content}
            </span>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {!collapsed && (
          <div className="card p-4">
            <div className="flex items-baseline justify-between text-[13px] font-medium text-slate">
              <span>Kullanım</span>
              <span className="mono text-muted">12 / 50</span>
            </div>
            <div className="my-2 h-[7px] overflow-hidden rounded-full bg-mist">
              <div className="grad h-full rounded-full" style={{ width: "24%" }} />
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted">video</span>
              <span className="font-semibold text-signal">Yükselt →</span>
            </div>
          </div>
        )}

        <span title="Fatura & plan" className={`nav-item cursor-default opacity-70 ${collapsed ? "justify-center" : ""}`}>
          <Icon.card className="flex-none" />
          {!collapsed && <span>Fatura &amp; plan</span>}
        </span>
        <span title="Ayarlar" className={`nav-item cursor-default opacity-70 ${collapsed ? "justify-center" : ""}`}>
          <Icon.settings className="flex-none" />
          {!collapsed && <span>Ayarlar</span>}
        </span>

        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
