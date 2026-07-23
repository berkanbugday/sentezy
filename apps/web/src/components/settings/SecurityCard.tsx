"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { PasswordInput } from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { passwordErrorMessage, validateNewPassword } from "@/lib/password";

const INPUT =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-signal";

/** Change the account password. Done client-side through Supabase — updateUser re-signs the
 *  current session in place, so there is no email round-trip and no API route.
 *
 *  Step-up: the CURRENT password is required and verified first (via signInWithPassword).
 *  updateUser on a live session does not check it, so without this anyone holding a signed-in
 *  session — a shared or stolen browser — could seize the account by resetting the password
 *  they never knew. `email` is the identity to re-verify against. */
export function SecurityCard({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const clearStatus = () => {
    setError(null);
    setDone(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateNewPassword(pw, confirm);
    if (invalid) {
      setError(passwordErrorMessage(invalid));
      return;
    }
    if (!email) {
      setError("We could not read your account email. Refresh the page.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    const supabase = createClient();

    // Prove the person knows the current password before letting them set a new one.
    const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: current });
    if (reauth) {
      setBusy(false);
      setError("That is not your current password");
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (authError) {
      setError(
        /different/i.test(authError.message)
          ? "Your new password has to be different from the old one"
          : "The password could not be changed. Try again.",
      );
      return;
    }
    setCurrent("");
    setPw("");
    setConfirm("");
    setDone(true);
  };

  return (
    <SettingsCard title="Password">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="current-pw" className="mb-1.5 block text-[13px] text-slate">
            Current password
          </label>
          <PasswordInput
            id="current-pw"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              clearStatus();
            }}
            autoComplete="current-password"
            placeholder="Your current password"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="new-pw" className="mb-1.5 block text-[13px] text-slate">
            New password
          </label>
          <PasswordInput
            id="new-pw"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              clearStatus();
            }}
            autoComplete="new-password"
            placeholder="En az 6 karakter"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="confirm-pw" className="mb-1.5 block text-[13px] text-slate">
            New password again
          </label>
          <PasswordInput
            id="confirm-pw"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearStatus();
            }}
            autoComplete="new-password"
            placeholder="Type it once more"
            className={INPUT}
          />
        </div>

        {error && <p className="text-[12.5px] text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={busy || !current || !pw || !confirm}
            className="btn btn-primary disabled:opacity-35"
          >
            {busy ? "Saving…" : "Change password"}
          </button>
          {done && (
            <span role="status" className="text-[13px] text-muted">
              Password changed
            </span>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}
