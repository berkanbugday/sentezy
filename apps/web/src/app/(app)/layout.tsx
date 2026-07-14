import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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

  return <AppShell user={info}>{children}</AppShell>;
}
