"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function Sidebar({ user }: { user: UserInfo }) {
  const pathname = usePathname();
  return (
    <aside className="hidden h-screen w-[264px] flex-none flex-col gap-1 overflow-y-auto border-r border-hairline bg-paper p-4 md:flex">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        <Image src="/sentezy-logo.png" alt="Sentezy" width={28} height={28} className="h-7 w-7" />
        <span className="disp text-[21px] font-bold tracking-tight text-ink">Sentezy</span>
      </div>

      <Link href="/create" className="btn btn-primary w-full">
        <Icon.plus width={18} height={18} />
        Yeni video
      </Link>

      <nav className="mt-4 flex flex-col gap-0.5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          const content = (
            <>
              <n.icon />
              <span>{n.label}</span>
              {!n.ready && <span className="ml-auto text-[10px] text-muted">yakında</span>}
            </>
          );
          return n.ready ? (
            <Link key={n.href} href={n.href} className="nav-item" data-active={active ? "true" : "false"}>
              {content}
            </Link>
          ) : (
            <span key={n.href} className="nav-item cursor-default opacity-70">
              {content}
            </span>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
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

        <span className="nav-item cursor-default opacity-70"><Icon.card /><span>Fatura &amp; plan</span></span>
        <span className="nav-item cursor-default opacity-70"><Icon.settings /><span>Ayarlar</span></span>

        <UserMenu user={user} />
      </div>
    </aside>
  );
}
