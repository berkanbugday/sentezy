import Image from "next/image";
import type { UserInfo } from "@/lib/user";
import { Icon } from "./icons";
import { UserMenu } from "./UserMenu";

const NAV = [
  { key: "dashboard", label: "Ana sayfa", icon: Icon.home, active: true },
  { key: "library", label: "Videolarım", icon: Icon.video },
  { key: "avatars", label: "Avatarlar", icon: Icon.users },
  { key: "templates", label: "Şablonlar", icon: Icon.grid },
  { key: "brand", label: "Marka kiti", icon: Icon.box },
];

export function Sidebar({ user }: { user: UserInfo }) {
  return (
    <aside className="hidden w-[264px] flex-none flex-col gap-1 border-r border-[var(--color-hairline)] bg-paper p-4 md:flex">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        <Image src="/sentezy-logo.png" alt="Sentezy" width={28} height={28} className="h-7 w-7" />
        <span className="disp text-[21px] font-bold tracking-tight text-ink">Sentezy</span>
      </div>

      <button className="btn btn-primary w-full">
        <Icon.plus width={18} height={18} />
        Yeni video
      </button>

      <nav className="mt-4 flex flex-col gap-0.5">
        {NAV.map((n) => (
          <a key={n.key} className="nav-item" data-active={n.active ? "true" : "false"}>
            <n.icon />
            <span>{n.label}</span>
          </a>
        ))}
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
            <a className="font-semibold text-signal">Yükselt →</a>
          </div>
        </div>

        <a className="nav-item"><Icon.card /><span>Fatura &amp; plan</span></a>
        <a className="nav-item"><Icon.settings /><span>Ayarlar</span></a>

        <UserMenu user={user} />
      </div>
    </aside>
  );
}
