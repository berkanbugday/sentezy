"use client";

import { useState } from "react";
import { type Avatar } from "@/components/wizard/types";
import { Icon } from "@/components/icons";
import { AGE_OPTS, type Age, GENDER_OPTS, type Gender, HIJAB_OPTS, type Hijab } from "@/lib/composer/avatarFilters";
import { useAvatars } from "@/lib/queries";
import { Dropdown } from "./Dropdown";

/** Avatar picker — owns the avatar list. Gender/age/hijab filter in the DB (query
 *  params); text search stays client-side. `onSelect` passes the chosen avatar up
 *  (or null when deselected) so the caller can label its chip. */
export function AvatarPicker({ open, onClose, selectedId, onSelect }: { open: boolean; onClose: () => void; selectedId: string | null; onSelect: (a: Avatar | null) => void }) {
  const [avatarQ, setAvatarQ] = useState("");
  const [avatarGender, setAvatarGender] = useState<Gender>("all");
  const [avatarAge, setAvatarAge] = useState<Age>("all");
  const [avatarHijab, setAvatarHijab] = useState<Hijab>("all");

  const avatarsQ = useAvatars({ gender: avatarGender, age: avatarAge, hijab: avatarHijab });
  const avatars = (avatarsQ.data ?? []).filter((a) => a.ready && a.id);

  const filteredAvatars = avatars.filter(
    (a) => !avatarQ.trim() || `${a.name} ${a.sectorLabel ?? ""}`.toLowerCase().includes(avatarQ.trim().toLowerCase()),
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Avatar seç</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
          <div className="mb-3 mt-2 flex flex-col gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon.search width={15} height={15} />
              </span>
              <input value={avatarQ} onChange={(e) => setAvatarQ(e.target.value)} placeholder="Avatar ara…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Dropdown value={avatarGender} onChange={(v) => setAvatarGender(v as Gender)} options={GENDER_OPTS} />
              <Dropdown value={avatarAge} onChange={(v) => setAvatarAge(v as Age)} options={AGE_OPTS} />
              <Dropdown value={avatarHijab} onChange={(v) => setAvatarHijab(v as Hijab)} options={HIJAB_OPTS} />
            </div>
          </div>
        </div>

        <div className="no-scrollbar overflow-y-auto px-5 py-4">
          {avatarsQ.isLoading ? (
            <div role="status" aria-live="polite">
              <span className="sr-only">Yükleniyor…</span>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i}>
                    <div className="ph-stripe aspect-[3/4] rounded-xl border border-hairline" />
                    <div className="mt-1.5 h-3 w-3/4 rounded bg-black/5" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredAvatars.length === 0 ? (
            <div className="py-10 text-center text-[14px] text-muted">Avatar bulunamadı</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {/* Faceless option — no avatar; the reel is B-roll + captions + voice only. */}
              <button type="button" onClick={() => { onSelect(null); onClose(); }} className="text-left">
                <div className={`relative flex aspect-[3/4] flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border bg-mist px-2 text-center transition ${selectedId === null ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                  <span className="disp text-[15px] font-semibold text-ink">Avatarsız</span>
                  <span className="text-[10px] leading-tight text-muted">yüzsüz video</span>
                </div>
                <div className="mt-1.5 truncate px-0.5 text-[12px] font-medium text-slate">İsimsiz</div>
              </button>
              {filteredAvatars.map((a) => {
                const sel = selectedId === a.id;
                return (
                  <button key={a.id} type="button" onClick={() => onSelect(sel ? null : a)} className="text-left">
                    <div className={`relative aspect-[3/4] overflow-hidden rounded-xl border bg-mist transition ${sel ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                      {sel && (
                        <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className={`mt-1.5 truncate px-0.5 text-[12px] font-medium ${sel ? "text-ink" : "text-slate"}`}>{a.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-none justify-end px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
          <button type="button" onClick={onClose} className="btn btn-primary min-w-28">
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
