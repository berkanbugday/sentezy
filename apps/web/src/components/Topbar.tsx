import type { UserInfo } from "@/lib/user";
import { Icon } from "./icons";

export function Topbar({ user }: { user: UserInfo }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-4 border-b border-hairline bg-paper px-6">
      <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-slate hover:bg-mist md:hidden">
        <Icon.menu />
      </button>
      <span className="text-[15px] font-semibold text-ink">Ana sayfa</span>

      <div className="relative ml-2 hidden max-w-[420px] flex-1 sm:block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon.search width={16} height={16} />
        </span>
        <input
          className="w-full rounded-lg border border-hairline bg-mist py-2 pl-9 pr-3 text-[13.5px] text-ink outline-none placeholder:text-muted focus:border-signal"
          placeholder="Video ara…"
        />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[13px] font-semibold text-ink">
          <Icon.bolt width={15} height={15} className="text-signal" />
          38 <span className="text-muted">kredi</span>
        </span>
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate hover:bg-mist">
          <Icon.sun />
        </button>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate hover:bg-mist">
          <Icon.bell />
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">
            3
          </span>
        </button>
        <div className="grad flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white">{user.initials}</div>
      </div>
    </header>
  );
}
