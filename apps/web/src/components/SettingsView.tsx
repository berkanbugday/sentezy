"use client";

import { useEffect, useState } from "react";
import { SecurityCard } from "@/components/settings/SecurityCard";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { toInitials } from "@/lib/user";
import { useProfile, useUpdateProfile } from "@/lib/queries";

const INPUT =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-signal";

/** Plan → Turkish label. Only "free" and "max" exist today; an unknown value shows as-is
 *  rather than a wrong guess. */
function planLabel(plan: string): string {
  if (plan === "free") return "Ücretsiz plan";
  if (plan === "max") return "MAX plan";
  return plan;
}

export function SettingsView() {
  const profileQ = useProfile();
  const updateName = useUpdateProfile();
  const p = profileQ.data;

  // The name field is a draft seeded once the profile lands, so typing is not overwritten
  // by a background refetch. Empty is allowed — it clears the name back to the email.
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (name === null && p) setName(p.displayName ?? "");
  }, [p, name]);

  const nameDirty = p != null && name != null && name.trim() !== (p.displayName ?? "");
  const displayName = p?.displayName?.trim() || p?.email || "";
  const initials = toInitials(displayName || "?");

  const saveName = async () => {
    if (name == null) return;
    await updateName.mutateAsync({ displayName: name.trim() || null });
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-7">
        <h1 className="disp text-[28px] font-semibold text-ink">Ayarlar</h1>
        <p className="mt-1 text-[14.5px] text-slate">Hesabını ve planını yönet.</p>
      </div>

      {profileQ.isLoading ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-5">
          <span className="sr-only">Yükleniyor…</span>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="h-4 w-24 rounded bg-black/5" />
              <div className="mt-4 h-10 rounded-xl bg-black/5" />
            </div>
          ))}
        </div>
      ) : profileQ.isError ? (
        <div className="card p-10 text-center">
          <p className="text-[14px] text-muted">Ayarlar yüklenemedi</p>
          <button type="button" onClick={() => profileQ.refetch()} className="mt-2 text-[13px] font-medium text-signal">
            Tekrar dene
          </button>
        </div>
      ) : p ? (
        <div className="flex flex-col gap-5">
          {/* ── Profil ── */}
          <SettingsCard title="Profil">
            <div className="flex items-center gap-4">
              <span className="grad grid h-14 w-14 flex-none place-items-center rounded-2xl text-[18px] font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-ink">{displayName}</div>
                <div className="truncate text-[13px] text-muted">{p.email}</div>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="displayName" className="mb-1.5 block text-[13px] text-slate">
                Görünen ad
              </label>
              <div className="flex gap-2">
                <input
                  id="displayName"
                  value={name ?? ""}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder={p.email ?? "Adın"}
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={!nameDirty || updateName.isPending}
                  className="btn btn-primary flex-none disabled:opacity-35"
                >
                  {updateName.isPending ? "…" : "Kaydet"}
                </button>
              </div>
              {updateName.isError && <p className="mt-1.5 text-[12.5px] text-red-600">Kaydedilemedi, tekrar dene.</p>}
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-hairline pt-4">
              <div>
                <div className="text-[13.5px] font-medium text-ink">E-posta</div>
                <div className="mt-0.5 text-[12.5px] text-muted">Giriş için kullandığın adres</div>
              </div>
              <span className="min-w-0 truncate text-[13.5px] text-slate">{p.email}</span>
            </div>
          </SettingsCard>

          {/* ── Plan ── */}
          <SettingsCard title="Plan">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <span className="h-2 w-2 rounded-full bg-ink" />
                  {planLabel(p.plan)}
                </div>
                <div className="mt-1 text-[13px] text-slate">
                  <span className="mono">{p.credits}</span> kredi kaldı
                </div>
              </div>
              {p.plan !== "max" && (
                <button type="button" className="btn btn-primary">
                  MAX&apos;e geç
                </button>
              )}
            </div>
          </SettingsCard>

          {/* ── Güvenlik ── */}
          <SecurityCard />
        </div>
      ) : null}
    </div>
  );
}
