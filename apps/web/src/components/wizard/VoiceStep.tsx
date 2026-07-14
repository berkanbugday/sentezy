"use client";

import { useRef, useState } from "react";
import type { Voice } from "./types";

/* ── 03 · Ses & dil ───────────────────────────────────────────────────── */
export function VoiceStep({
  voices,
  selected,
  onSelect,
  error,
}: {
  voices: Voice[];
  selected?: string;
  onSelect: (id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = voices.find((v) => v.id === selected);
  return (
    <div>
      <p className="mb-4 text-[13px] text-slate">
        Videonu seslendirecek ElevenLabs sesini seç — {voices.length} ses, cinsiyet, yaş ve aksana göre filtrele.
      </p>
      {current ? (
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-hairline bg-mist">
            <Waveform active />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink">{current.label}</div>
            <div className="text-[12px] text-muted">{[current.gender, current.age, current.accent, current.useCase].filter(Boolean).join(" · ") || "—"}</div>
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
          <span className="text-[18px]">＋</span> Ses kütüphanesini aç
        </button>
      )}
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}

      {open && (
        <VoiceModal
          voices={voices}
          selected={selected}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onSelect(id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function VoiceModal({
  voices,
  selected,
  onClose,
  onPick,
}: {
  voices: Voice[];
  selected?: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [accent, setAccent] = useState("");
  const [useCase, setUseCase] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function sample(v: Voice) {
    if (!v.previewUrl) return;
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (playingId === v.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = v.previewUrl;
    audio.onended = () => setPlayingId(null);
    void audio.play();
    setPlayingId(v.id);
  }

  // Distinct label values present in the catalog — powers the ElevenLabs-style
  // filter dropdowns (only facets that actually occur are offered).
  const facet = (pick: (v: Voice) => string | null | undefined) =>
    [...new Set(voices.map(pick).filter((x): x is string => Boolean(x)))].sort();
  const genders = facet((v) => v.gender);
  const ages = facet((v) => v.age);
  const accents = facet((v) => v.accent);
  const useCases = facet((v) => v.useCase);

  const q = search.trim().toLocaleLowerCase("tr");
  const filtered = voices.filter(
    (v) =>
      (!gender || v.gender === gender) &&
      (!age || v.age === age) &&
      (!accent || v.accent === accent) &&
      (!useCase || v.useCase === useCase) &&
      (!q || v.label.toLocaleLowerCase("tr").includes(q)),
  );

  const selectClass = "rounded-full border border-hairline bg-mist px-3 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h3 className="disp text-[17px] font-semibold text-ink">Ses kütüphanesi</h3>
            <p className="text-[12px] text-muted">{voices.length} ses · ElevenLabs</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-[18px] text-muted transition hover:bg-mist">
            ×
          </button>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim ara…"
            className="min-w-[140px] flex-1 rounded-full border border-hairline bg-mist px-3.5 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal"
          />
          {genders.length > 0 && (
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
              <option value="">Tüm cinsiyetler</option>
              {genders.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          {ages.length > 0 && (
            <select value={age} onChange={(e) => setAge(e.target.value)} className={selectClass}>
              <option value="">Tüm yaşlar</option>
              {ages.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {accents.length > 0 && (
            <select value={accent} onChange={(e) => setAccent(e.target.value)} className={selectClass}>
              <option value="">Tüm aksanlar</option>
              {accents.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {useCases.length > 0 && (
            <select value={useCase} onChange={(e) => setUseCase(e.target.value)} className={selectClass}>
              <option value="">Tüm kullanımlar</option>
              {useCases.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>

        {/* list */}
        <div className="flex flex-col gap-2.5 overflow-y-auto p-5">
          {filtered.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onPick(v.id)}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                selected === v.id ? "border-signal bg-[var(--wash)]" : "border-hairline bg-paper hover:border-signal/50"
              }`}
            >
              {v.previewUrl && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); sample(v); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); sample(v); } }}
                  aria-label="Sesi dinle"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:opacity-90"
                >
                  {playingId === v.id ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink">{v.label}</span>
                <span className="block truncate text-[12px] text-muted">{[v.gender, v.age, v.accent, v.useCase].filter(Boolean).join(" · ")}</span>
              </span>
              <Waveform active={selected === v.id || playingId === v.id} />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted">
              {voices.length === 0 ? "Sesler yükleniyor…" : "Bu filtrelere uygun ses yok."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [8, 14, 6, 16, 10, 13, 7];
  return (
    <span className="flex h-5 items-center gap-[3px]">
      {bars.map((hgt, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-colors"
          style={{ height: hgt, background: active ? "var(--color-signal)" : "var(--color-hairline)" }}
        />
      ))}
    </span>
  );
}
