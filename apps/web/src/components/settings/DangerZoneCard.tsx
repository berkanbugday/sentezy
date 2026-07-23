"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { createClient } from "@/lib/supabase/client";
import { useDeleteAccount } from "@/lib/queries";

const INPUT =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-signal";

/** Permanently delete the account. Two-step: an "expanded" state reveals a typed
 *  confirmation, and the delete only fires once the typed text matches the account email
 *  exactly. Irreversible, so the barrier is deliberate — this is not a button you can hit
 *  by accident. */
export function DangerZoneCard({ email }: { email: string | null }) {
  const router = useRouter();
  const del = useDeleteAccount();
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirmed = Boolean(email) && typed.trim().toLowerCase() === email!.trim().toLowerCase();

  const remove = async () => {
    setError(null);
    try {
      await del.mutateAsync();
    } catch {
      // The data may be gone but the auth identity survived (502) — or the network failed.
      // Either way the account is not cleanly removed, so say so rather than signing out.
      setError("The account could not be deleted. Try again, or contact support.");
      return;
    }
    // Account is gone — end the local session and leave.
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <SettingsCard
      title="Danger zone"
      description="Deleting your account permanently removes your videos, presenters and brand kit. This cannot be undone."
      tone="danger"
    >
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-full border border-red-300 px-4 py-2 text-[13.5px] font-semibold text-red-600 transition hover:bg-red-50"
        >
          Delete account
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="confirm-email" className="mb-1.5 block text-[13px] text-slate">
              Type your email to confirm: <span className="font-medium text-ink">{email}</span>
            </label>
            <input
              id="confirm-email"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              placeholder={email ?? ""}
              className={INPUT}
            />
          </div>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={!confirmed || del.isPending}
              className="rounded-full bg-red-600 px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-35"
            >
              {del.isPending ? "Deleting…" : "Delete my account permanently"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setTyped("");
                setError(null);
              }}
              disabled={del.isPending}
              className="text-[13px] font-medium text-muted transition hover:text-ink disabled:opacity-35"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
