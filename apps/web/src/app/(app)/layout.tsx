import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { createClient } from "@/lib/supabase/server";
import { type UserInfo, toInitials } from "@/lib/user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const name = meta.display_name || meta.name || user.email!.split("@")[0];
  const info: UserInfo = { name, email: user.email!, initials: toInitials(name) };

  return (
    <div className="flex h-screen overflow-hidden [background:var(--frame)]">
      <Sidebar user={info} />
      {/* inset floating workspace: white panel with a gray gutter around it */}
      <div className="min-w-0 flex-1 py-2.5 pr-2.5">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-hairline bg-paper">
          <Topbar />
          <main className="no-scrollbar flex-1 overflow-y-auto px-6 pb-12 pt-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
