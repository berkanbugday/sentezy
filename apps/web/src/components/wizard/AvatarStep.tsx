"use client";

import { useState } from "react";
import { chipClass } from "./constants";
import type { Avatar } from "./types";

const AGE_LABEL: Record<Avatar["age"], string> = { genç: "Genç", yetişkin: "Yetişkin", olgun: "Olgun" };

/* ── 02 · Avatar — pick from the 100-presenter library (no upload) ─────── */
export function AvatarStep({
  avatars,
  selectedImageUrl,
  selectedName,
  onSelect,
  busy,
  error,
}: {
  avatars: Avatar[];
  selectedImageUrl?: string | null;
  selectedName?: string | null;
  onSelect: (a: Avatar) => void;
  busy?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const readyCount = avatars.filter((a) => a.ready).length;
  return (
    <div>
      <p className="mb-4 text-[13px] text-slate">
        Videoda konuşacak AI sunucuyu seç — {readyCount} sektörel avatar, sektöre ve profile göre filtrele.
      </p>
      {selectedImageUrl ? (
        <div className="flex items-center gap-4">
          <div className="h-28 w-24 overflow-hidden rounded-2xl border border-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImageUrl} alt={selectedName ?? ""} className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink">{selectedName}</div>
            <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-[13px] font-medium text-signal hover:underline">
              Değiştir
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-mist py-10 text-[14px] font-medium text-slate transition hover:border-signal"
        >
          <span className="text-[18px]">＋</span> Avatar kütüphanesini aç
        </button>
      )}
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}

      {open && (
        <AvatarModal
          avatars={avatars}
          readyCount={readyCount}
          selectedImageUrl={selectedImageUrl}
          busy={busy}
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onSelect(a);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AvatarModal({
  avatars,
  readyCount,
  selectedImageUrl,
  busy,
  onClose,
  onPick,
}: {
  avatars: Avatar[];
  readyCount: number;
  selectedImageUrl?: string | null;
  busy?: boolean;
  onClose: () => void;
  onPick: (a: Avatar) => void;
}) {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"" | Avatar["gender"]>("");
  const [age, setAge] = useState<"" | Avatar["age"]>("");
  const [sector, setSector] = useState("");

  // Only avatars with a generated portrait are pickable, so the library and its
  // filters are built from the ready set — pending ones are hidden entirely.
  const ready = avatars.filter((a) => a.ready);
  // Sectors present in the library, in catalog order — for the dropdown.
  const sectors = [...new Map(ready.map((a) => [a.sector, a.sectorLabel])).entries()];
  const q = search.trim().toLocaleLowerCase("tr");
  const filtered = ready.filter(
    (a) =>
      (!gender || a.gender === gender) &&
      (!age || a.age === age) &&
      (!sector || a.sector === sector) &&
      (!q || a.name.toLocaleLowerCase("tr").includes(q) || a.sectorLabel.toLocaleLowerCase("tr").includes(q)),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h3 className="disp text-[17px] font-semibold text-ink">Avatar kütüphanesi</h3>
            <p className="text-[12px] text-muted">{readyCount} avatar</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-[18px] text-muted transition hover:bg-mist">
            ×
          </button>
        </div>

        {/* filters */}
        <div className="flex flex-col gap-3 border-b border-hairline px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya sektör ara…"
              className="min-w-[160px] flex-1 rounded-full border border-hairline bg-mist px-3.5 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal"
            />
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="rounded-full border border-hairline bg-mist px-3 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal"
            >
              <option value="">Tüm sektörler</option>
              {sectors.map(([slug, label]) => (
                <option key={slug} value={slug}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setGender("")} className={chipClass(!gender)}>Herkes</button>
            <button type="button" onClick={() => setGender("kadın")} className={chipClass(gender === "kadın")}>Kadın</button>
            <button type="button" onClick={() => setGender("erkek")} className={chipClass(gender === "erkek")}>Erkek</button>
            <span className="mx-1 h-4 w-px bg-hairline" />
            <button type="button" onClick={() => setAge("")} className={chipClass(!age)}>Tüm yaşlar</button>
            {(["genç", "yetişkin", "olgun"] as const).map((a) => (
              <button key={a} type="button" onClick={() => setAge(a)} className={chipClass(age === a)}>{AGE_LABEL[a]}</button>
            ))}
          </div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((a) => {
            const active = selectedImageUrl === a.imageUrl;
            return (
              <button
                key={a.slug}
                type="button"
                disabled={busy}
                title={a.name}
                onClick={() => onPick(a)}
                className={`group overflow-hidden rounded-2xl border text-left transition disabled:cursor-not-allowed ${
                  active ? "border-signal ring-2 ring-signal/30" : "border-hairline hover:border-signal/50"
                }`}
              >
                <div className="relative aspect-[3/4] w-full bg-mist">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                </div>
                <div className="px-2.5 py-2">
                  <div className="truncate text-[13px] font-semibold text-ink">{a.name}</div>
                  <div className="truncate text-[11px] text-muted">{a.sectorLabel}</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-[13px] text-muted">
              {ready.length === 0 ? "Avatarlar yükleniyor…" : "Bu filtrelere uygun avatar yok."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
