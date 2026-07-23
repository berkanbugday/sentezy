"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { type MusicTrack, useMusic } from "@/lib/queries";
import { Spinner } from "./Spinner";

/** mm:ss, or "" when the catalog has no duration for the track. */
function fmt(sec: number): string {
  if (!sec || sec <= 0) return "";
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

/** Background-music picker — mirrors VoicePicker: mood chips filtered server-side, text
 *  search over the loaded page, per-row audio preview, and a "Yok" (none) escape hatch.
 *  The chosen track's level rides along so the caller can send it with the render.
 *
 *  Deliberate divergence from VoicePicker: picking a track does NOT close the modal.
 *  Music, unlike voice, has a follow-up control (the level slider below), and it only
 *  renders once a track is selected — closing immediately meant nobody ever saw it
 *  in the same session they picked a track. Selecting "Yok" still closes right away
 *  (there's nothing to follow up on), and there's an explicit "Bitti" button to close
 *  once a track is chosen. */
export function MusicPicker({
  open,
  onClose,
  selectedKey,
  onSelect,
  volume,
  onVolumeChange,
}: {
  open: boolean;
  onClose: () => void;
  selectedKey: string | null;
  onSelect: (t: MusicTrack | null) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  const [mood, setMood] = useState("");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicQ = useMusic(mood, open);
  const tracks = musicQ.data?.music ?? [];
  const moods = musicQ.data?.moods ?? [];

  const filtered = tracks.filter(
    (t) => !q.trim() || `${t.name} ${t.moodLabel}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }
  function play(t: MusicTrack) {
    if (playing === t.key) return stop();
    audioRef.current?.pause();
    const a = new Audio(t.previewUrl);
    a.volume = 0.7;
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    setPlaying(t.key);
  }

  // Never leave a preview playing behind a closed modal.
  useEffect(() => {
    if (!open) stop();
  }, [open]);
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Choose music</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search music"
            className="mt-3 w-full rounded-full border border-hairline bg-paper px-4 py-2 text-[13.5px] text-ink outline-none placeholder:text-muted focus:border-ink"
          />
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMood("")}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${mood === "" ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
            >
              All
            </button>
            {moods.map((m) => (
              <button
                key={m.slug}
                type="button"
                onClick={() => setMood(m.slug)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${mood === m.slug ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="no-scrollbar mt-2 flex-1 overflow-y-auto px-5 pb-2">
          <button
            type="button"
            onClick={() => { stop(); onSelect(null); onClose(); }}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${!selectedKey ? "border-ink bg-mist" : "border-hairline hover:bg-mist"}`}
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-hairline text-muted">
              <Icon.close width={15} height={15} />
            </span>
            <span className="text-[14px] font-medium text-ink">Yok</span>
          </button>

          {musicQ.isLoading && (
            <div className="flex items-center gap-2 px-1 py-4 text-[13px] text-muted">
              <Spinner size={14} /> Loading…
            </div>
          )}
          {!musicQ.isLoading && filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] text-muted">No tracks in that mood.</p>
          )}

          {filtered.map((t) => (
            <div
              key={t.key}
              className={`mt-2 flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${selectedKey === t.key ? "border-ink bg-mist" : "border-hairline"}`}
            >
              <button
                type="button"
                onClick={() => play(t)}
                aria-label={playing === t.key ? `Stop ${t.name}` : `Play ${t.name}`}
                className="grid h-9 w-9 flex-none place-items-center rounded-full border border-hairline text-ink transition hover:bg-paper"
              >
                {playing === t.key ? <Icon.pause width={14} height={14} /> : <Icon.play width={14} height={14} />}
              </button>
              <button
                type="button"
                onClick={() => { stop(); onSelect(t); }}
                className="flex-1 text-left"
              >
                <div className="text-[14px] font-medium text-ink">{t.name}</div>
                <div className="text-[12px] text-muted">
                  {t.moodLabel}
                  {fmt(t.durationSec) && ` · ${fmt(t.durationSec)}`}
                </div>
              </button>
            </div>
          ))}
        </div>

        {selectedKey && (
          <div className="flex-none border-t border-hairline px-5 py-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
              <span>Music level</span>
              <span className="mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-full accent-ink"
            />
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-full bg-ink py-2.5 text-[13.5px] font-medium text-paper transition hover:opacity-90"
            >
              Bitti
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
