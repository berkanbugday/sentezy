"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserInfo } from "@/lib/user";
import { Icon } from "./icons";
import { Tooltip } from "./Tooltip";

/** Workspace switcher (mirrors the reference's "Berkan's Team ⌄"). Holds the
 *  account menu — settings + sign out — so nothing is lost from the old footer. */
export function TeamSwitcher({ user, collapsed }: { user: UserInfo; collapsed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const avatar = (
    <span className="grad flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[12px] font-bold text-white">
      {user.initials}
    </span>
  );

  if (collapsed) {
    return (
      <Tooltip label={`${user.name} — çalışma alanı`}>
        <button className="flex items-center justify-center rounded-xl p-1.5 hover:bg-white/10">{avatar}</button>
      </Tooltip>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/10"
      >
        {avatar}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{user.name}</span>
        <Icon.chevronDown width={16} height={16} className="flex-none text-white/60" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-hairline bg-paper py-1 shadow-lg">
          <div className="truncate px-3 py-1.5 text-[11px] text-muted">{user.email}</div>
          <button className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-slate hover:bg-mist">
            <Icon.settings width={16} height={16} />
            Ayarlar
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-slate hover:bg-mist"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
}
