"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserInfo } from "@/lib/user";

export function UserMenu({ user, collapsed }: { user: UserInfo; collapsed?: boolean }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  if (collapsed) {
    return (
      <button
        onClick={signOut}
        title={`${user.name} — log out`}
        className="mt-1 flex items-center justify-center rounded-xl p-2 hover:bg-mist"
      >
        <span className="grad flex h-9 w-9 flex-none items-center justify-center rounded-full text-[13px] font-bold text-white">
          {user.initials}
        </span>
      </button>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-3 rounded-xl p-2 hover:bg-mist">
      <div className="grad flex h-9 w-9 flex-none items-center justify-center rounded-full text-[13px] font-bold text-white">
        {user.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">{user.name}</div>
        <div className="truncate text-[11px] text-muted">{user.email}</div>
      </div>
      <button
        onClick={signOut}
        title="Log out"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted hover:bg-hairline hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      </button>
    </div>
  );
}
