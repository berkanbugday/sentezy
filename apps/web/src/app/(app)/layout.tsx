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
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={info} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={info} />
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
