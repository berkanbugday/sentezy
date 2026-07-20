"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { PasswordInput } from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { passwordErrorMessage, validateNewPassword } from "@/lib/password";

const INPUT =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-signal";

/** Change the account password. Done client-side through Supabase — updateUser re-signs the
 *  current session in place, so there is no email round-trip and no API route. */
export function SecurityCard() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateNewPassword(pw, confirm);
    if (invalid) {
      setError(passwordErrorMessage(invalid));
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    const { error: authError } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (authError) {
      // Supabase's own message is English and often "New password should be different…";
      // surface a Turkish line and keep the raw one out of the UI.
      setError(
        /different/i.test(authError.message)
          ? "Yeni şifre eskisinden farklı olmalı"
          : "Şifre güncellenemedi. Tekrar dene.",
      );
      return;
    }
    setPw("");
    setConfirm("");
    setDone(true);
  };

  return (
    <SettingsCard title="Güvenlik">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="new-pw" className="mb-1.5 block text-[13px] text-slate">
            Yeni şifre
          </label>
          <PasswordInput
            id="new-pw"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setDone(false);
            }}
            autoComplete="new-password"
            placeholder="En az 6 karakter"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="confirm-pw" className="mb-1.5 block text-[13px] text-slate">
            Yeni şifre (tekrar)
          </label>
          <PasswordInput
            id="confirm-pw"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setDone(false);
            }}
            autoComplete="new-password"
            placeholder="Şifreyi tekrar gir"
            className={INPUT}
          />
        </div>

        {error && <p className="text-[12.5px] text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={busy || !pw || !confirm} className="btn btn-primary disabled:opacity-35">
            {busy ? "Güncelleniyor…" : "Şifreyi güncelle"}
          </button>
          {done && (
            <span role="status" className="text-[13px] text-muted">
              Şifre güncellendi
            </span>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}
