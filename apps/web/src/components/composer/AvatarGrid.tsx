"use client";

import { useState } from "react";
import { type Avatar } from "@/components/wizard/types";
import { Icon } from "@/components/icons";
import { AGE_OPTS, type Age, GENDER_OPTS, type Gender, HIJAB_OPTS, type Hijab } from "@/lib/composer/avatarFilters";
import { useAvatars } from "@/lib/queries";
import { Dropdown } from "./Dropdown";

/** The avatar catalog browser — owns the query, the search box and the gender/age/hijab
 *  filters, and renders the tiles. Shared by the composer's picker sheet and the /avatars
 *  page so the two can never drift.
 *
 *  Only ~12 of the 126 catalogued personas have a rendered portrait, so tiles are filtered
 *  to `ready && id`. There is deliberately NO sector filter: ten sectors hold one or two
 *  ready avatars and fourteen hold none, so it would mostly return an empty grid. */
export function AvatarGrid({
  onSelect,
  selectedId = null,
  showNoneOption = false,
  columns = "sheet",
}: {
  onSelect: (a: Avatar | null) => void;
  selectedId?: string | null;
  showNoneOption?: boolean;
  columns?: "sheet" | "page";
}) {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<Gender>("all");
  const [age, setAge] = useState<Age>("all");
  const [hijab, setHijab] = useState<Hijab>("all");

  const avatarsQ = useAvatars({ gender, age, hijab });
  const ready = (avatarsQ.data ?? []).filter((a) => a.ready && a.id);
  const filtered = ready.filter(
    (a) => !q.trim() || `${a.name} ${a.sectorLabel ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const hasFilters = Boolean(q.trim()) || gender !== "all" || age !== "all" || hijab !== "all";
  const clearFilters = () => {
    setQ("");
    setGender("all");
    setAge("all");
    setHijab("all");
  };

  const gridCls =
    columns === "page"
      ? "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      : "grid grid-cols-3 gap-3 sm:grid-cols-4";

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 bg-paper pb-2 flex flex-col gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon.search width={15} height={15} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Avatar ara…"
            className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Dropdown value={gender} onChange={(v) => setGender(v as Gender)} options={GENDER_OPTS} />
          <Dropdown value={age} onChange={(v) => setAge(v as Age)} options={AGE_OPTS} />
          <Dropdown value={hijab} onChange={(v) => setHijab(v as Hijab)} options={HIJAB_OPTS} />
        </div>
      </div>

      {avatarsQ.isLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Yükleniyor…</span>
          <div className={gridCls}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="ph-stripe aspect-[3/4] rounded-xl border border-hairline" />
                <div className="mt-1.5 h-3 w-3/4 rounded bg-black/5" />
              </div>
            ))}
          </div>
        </div>
      ) : avatarsQ.isError ? (
        /* A failed request is NOT an empty result — never blame the user's filters for it. */
        <div className="py-10 text-center">
          <p className="text-[14px] text-muted">Avatarlar yüklenemedi</p>
          <button type="button" onClick={() => avatarsQ.refetch()} className="mt-2 text-[13px] font-medium text-signal">
            Tekrar dene
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[14px] text-muted">Avatar bulunamadı</p>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="mt-2 text-[13px] font-medium text-signal">
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className={gridCls}>
          {showNoneOption && (
            /* Faceless option — no avatar; the reel is B-roll + captions + voice only. */
            <button type="button" onClick={() => onSelect(null)} className="text-left">
              <div className={`relative flex aspect-[3/4] flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border bg-mist px-2 text-center transition ${selectedId === null ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                <span className="disp text-[15px] font-semibold text-ink">Avatarsız</span>
                <span className="text-[10px] leading-tight text-muted">yüzsüz video</span>
              </div>
              <div className="mt-1.5 truncate px-0.5 text-[12px] font-medium text-slate">İsimsiz</div>
            </button>
          )}
          {filtered.map((a) => {
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
                {columns === "page" && a.sectorLabel && (
                  <div className="truncate px-0.5 text-[11px] text-muted">{a.sectorLabel}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
