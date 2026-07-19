"use client";

import { useEffect, useRef, useState } from "react";
import { type Voice } from "@/components/wizard/types";
import { Icon } from "@/components/icons";
import { V_ACCENT, V_AGE, V_CATEGORY, V_GENDER, V_LANG, V_USECASE } from "@/lib/composer/voiceFilters";
import { useVoicePreview, useVoicesInfinite } from "@/lib/queries";
import { Spinner } from "./Spinner";
import { VoiceSkeleton } from "./VoiceSkeleton";

/** Voice picker — owns the paginated voice query, server-side filters, the filters
 *  sheet, infinite scroll, and TTS preview. `script` drives the opt-in real-text
 *  preview and `emotion` gives it the same delivery the render will use; `onSelect`
 *  passes the chosen voice up (or null) for the caller's chip. */
export function VoicePicker({ open, onClose, selectedId, onSelect, script, emotion = "" }: { open: boolean; onClose: () => void; selectedId: string | null; onSelect: (v: Voice | null) => void; script: string; emotion?: string }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [voiceQ, setVoiceQ] = useState("");
  const [voiceGender, setVoiceGender] = useState("");
  const [voiceAge, setVoiceAge] = useState("");
  const [voiceCategory, setVoiceCategory] = useState("");
  const [voiceLang, setVoiceLang] = useState("");
  const [voiceUseCase, setVoiceUseCase] = useState("");
  const [voiceAccent, setVoiceAccent] = useState("");
  const [realTts, setRealTts] = useState(false); // preview with the user's own text
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceListRef = useRef<HTMLDivElement>(null);
  const voiceSentinelRef = useRef<HTMLDivElement>(null);

  const hasScript = script.trim().length > 0;
  const voicesQ = useVoicesInfinite({ gender: voiceGender, age: voiceAge, category: voiceCategory, language: voiceLang, use_cases: voiceUseCase, accent: voiceAccent });
  const voices = voicesQ.data?.pages.flatMap((p) => p.voices) ?? [];
  const voicePreview = useVoicePreview();

  const voiceFilterGroups = [
    { title: "Cinsiyet", value: voiceGender, set: setVoiceGender, options: V_GENDER },
    { title: "Yaş", value: voiceAge, set: setVoiceAge, options: V_AGE },
    { title: "Dil", value: voiceLang, set: setVoiceLang, options: V_LANG },
    { title: "Aksan", value: voiceAccent, set: setVoiceAccent, options: V_ACCENT },
    { title: "Kullanım", value: voiceUseCase, set: setVoiceUseCase, options: V_USECASE },
    { title: "Tür", value: voiceCategory, set: setVoiceCategory, options: V_CATEGORY },
  ];
  const activeVoiceFilters = voiceFilterGroups.filter((g) => g.value !== "").length;
  function clearVoiceFilters() {
    setVoiceGender("");
    setVoiceAge("");
    setVoiceLang("");
    setVoiceAccent("");
    setVoiceUseCase("");
    setVoiceCategory("");
  }

  // voices are already filtered server-side by the dropdowns — only refine by text search
  const filteredVoices = voices.filter(
    (v) => !voiceQ.trim() || `${v.label} ${v.style ?? ""} ${v.accent ?? ""} ${v.descriptive ?? ""}`.toLowerCase().includes(voiceQ.trim().toLowerCase()),
  );

  function stopVoicePreview() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingVoice(null);
  }
  async function playVoice(id: string, previewUrl?: string | null) {
    if (playingVoice === id) return stopVoicePreview();
    audioRef.current?.pause();
    setTtsError(null);
    let url: string | null = null;
    const text = script.trim();
    if (realTts && text) {
      // synthesize the user's own text with this voice (opt-in real TTS)
      setTtsLoading(id);
      try {
        const { audio, mime } = await voicePreview.mutateAsync({ id, text, emotion });
        url = `data:${mime};base64,${audio}`;
      } catch (e) {
        setTtsLoading(null);
        setTtsError(e instanceof Error && e.message ? e.message : "Ses üretilemedi — API'yi yeniden başlat ve ElevenLabs anahtarını kontrol et.");
        return;
      }
      setTtsLoading(null);
    } else {
      url = previewUrl ?? null;
    }
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setPlayingVoice(null);
    a.play().catch(() => setTtsError("Tarayıcı otomatik oynatmayı engelledi — tekrar dokun."));
    setPlayingVoice(id);
  }
  useEffect(() => {
    if (!open) stopVoicePreview();
  }, [open]);
  useEffect(() => () => stopVoicePreview(), []);

  // infinite scroll: load the next page when the sentinel nears the bottom
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = voicesQ;
  useEffect(() => {
    if (!open) return;
    const sentinel = voiceSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { root: voiceListRef.current, rootMargin: "160px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
        <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
          <div className="flex-none px-5 pt-5">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Ses seç</h3>
              <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                <Icon.close width={18} height={18} className="block" />
              </button>
            </div>
            <div className="mb-3 mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <Icon.search width={15} height={15} />
                </span>
                <input value={voiceQ} onChange={(e) => setVoiceQ(e.target.value)} placeholder="Ses ara…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="flex flex-none items-center gap-1.5 rounded-full border border-hairline bg-paper px-3.5 py-2 text-[13px] font-medium text-slate transition hover:bg-mist"
              >
                <Icon.filter width={16} height={16} />
                Filtrele
                {activeVoiceFilters > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{activeVoiceFilters}</span>
                )}
              </button>
            </div>
          </div>

          <div ref={voiceListRef} className="no-scrollbar flex flex-col gap-1.5 overflow-y-auto px-5 py-4">
            {voicesQ.isLoading ? (
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <VoiceSkeleton key={i} />
                ))}
              </div>
            ) : filteredVoices.length === 0 ? (
              <div className="py-10 text-center text-[14px] text-muted">Ses bulunamadı</div>
            ) : (
              filteredVoices.map((v) => {
                const sel = selectedId === v.id;
                const meta = [v.gender, v.style, v.age].filter(Boolean).join(" · ");
                return (
                  <div key={v.id} className={`flex items-center gap-2 rounded-xl border p-2 transition ${sel ? "border-ink ring-1 ring-ink" : "border-hairline"}`}>
                    <button type="button" onClick={() => onSelect(sel ? null : v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${sel ? "bg-ink text-paper" : "bg-mist text-slate"}`}>
                        <Icon.voice width={16} height={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-ink">{v.label}</div>
                        {meta && <div className="truncate text-[11.5px] text-muted">{meta}</div>}
                      </div>
                    </button>
                    {(v.previewUrl || realTts) && (
                      <button
                        type="button"
                        onClick={() => playVoice(v.id, v.previewUrl)}
                        disabled={ttsLoading === v.id}
                        aria-label="Önizle"
                        className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border transition disabled:opacity-50 sm:h-9 sm:w-9 ${playingVoice === v.id ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist hover:text-ink"}`}
                      >
                        {ttsLoading === v.id ? <Spinner size={16} /> : playingVoice === v.id ? <Icon.pause width={17} height={17} /> : <Icon.play width={17} height={17} />}
                      </button>
                    )}
                  </div>
                );
              })
            )}
            {voicesQ.isFetchingNextPage && Array.from({ length: 3 }).map((_, i) => <VoiceSkeleton key={`sk-${i}`} />)}
            <div ref={voiceSentinelRef} className="h-1 w-full" />
          </div>

          {ttsError && <div className="flex-none px-5 pb-1 text-[12px] text-[#dc2626]">{ttsError}</div>}

          <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
            {hasScript ? (
              <button
                type="button"
                role="switch"
                aria-checked={realTts}
                onClick={() => {
                  setRealTts((r) => !r);
                  stopVoicePreview();
                }}
                className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
              >
                <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${realTts ? "bg-ink" : "bg-hairline"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${realTts ? "left-[18px]" : "left-0.5"}`} />
                </span>
                Yazdığım metni oku
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClose} className="btn btn-primary min-w-28">
              Tamam
            </button>
          </div>
        </div>
      </div>

      {/* voice filters */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="disp text-[18px] font-semibold text-ink">Filtreler</h3>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
            </div>
            <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 py-4">
              {voiceFilterGroups.map((g) => (
                <div key={g.title}>
                  <div className="mb-2 text-[13px] font-semibold text-ink">{g.title}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => (
                      <button key={o.v} type="button" onClick={() => g.set(o.v)} className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${g.value === o.v ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>
                        {o.v === "" ? "Tümü" : o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              <button type="button" onClick={clearVoiceFilters} className="rounded-full border border-hairline px-4 py-2 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink">
                Temizle
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="btn btn-primary min-w-28">
                Uygula ({filteredVoices.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
