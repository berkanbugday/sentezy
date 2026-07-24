"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { CAPTION_COLORS, CAPTION_FAMILIES, CAPTION_FONTS, CAPTION_PRESETS } from "@/lib/captionStyles";
import { CaptionTile } from "./CaptionTile";

/** Caption-style picker — owns the local catalog filters + incremental reveal. Each tile is a
 *  live self-animating preview of the real caption component. `onSelect(id)` sets the preset;
 *  `onSelect(null)` clears it (captions are opt-in — "No captions" is a first-class choice,
 *  not just the absence of one, so a user who picked a style can turn captions back off). */
export function CaptionPicker({ open, onClose, selectedId, onSelect }: { open: boolean; onClose: () => void; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [captionQ, setCaptionQ] = useState("");
  const [captionFamily, setCaptionFamily] = useState(""); // "" = all
  const [captionFontF, setCaptionFontF] = useState("");
  const [captionColorF, setCaptionColorF] = useState("");
  const [captionFiltersOpen, setCaptionFiltersOpen] = useState(false);
  const [captionShown, setCaptionShown] = useState(60); // incremental reveal count
  const captionSentinelRef = useRef<HTMLDivElement>(null);

  const filteredCaptions = CAPTION_PRESETS.filter(
    (p) =>
      (!captionFamily || p.family === captionFamily) &&
      (!captionFontF || p.font === captionFontF) &&
      (!captionColorF || p.color === captionColorF) &&
      (!captionQ.trim() || p.name.toLowerCase().includes(captionQ.trim().toLowerCase())),
  );
  const activeCaptionFilters = [captionFamily, captionFontF, captionColorF].filter(Boolean).length;
  useEffect(() => { setCaptionShown(60); }, [captionQ, captionFamily, captionFontF, captionColorF]);
  useEffect(() => {
    if (!open) return;
    const el = captionSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) setCaptionShown((n) => n + 60); });
    io.observe(el);
    return () => io.disconnect();
  }, [open, filteredCaptions.length]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Caption style</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
          <div className="mb-3 mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon.search width={15} height={15} />
              </span>
              <input value={captionQ} onChange={(e) => setCaptionQ(e.target.value)} placeholder="Search styles…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
            </div>
            <button type="button" onClick={() => setCaptionFiltersOpen(true)} className="flex flex-none items-center gap-1.5 rounded-full border border-hairline bg-paper px-3.5 py-2 text-[13px] font-medium text-slate transition hover:bg-mist">
              <Icon.filter width={16} height={16} />
              Filter
              {activeCaptionFilters > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{activeCaptionFilters}</span>}
            </button>
          </div>
        </div>

        <div className="no-scrollbar overflow-y-auto px-5 py-4">
          {/* explicit "no captions" choice — always visible, unaffected by search/filters */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`mb-3 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-[13px] font-medium transition ${selectedId === null ? "border-ink bg-mist text-ink" : "border-hairline text-slate hover:bg-mist"}`}
          >
            <span className="flex items-center gap-2">
              <Icon.close width={15} height={15} />
              No captions
            </span>
            {selectedId === null && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
            )}
          </button>
          {filteredCaptions.length === 0 ? (
            <div className="py-10 text-center text-[14px] text-muted">No style matches those filters.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredCaptions.slice(0, captionShown).map((p) => (
                  <CaptionTile key={p.id} preset={p} selected={selectedId === p.id} onSelect={() => onSelect(p.id)} />
                ))}
              </div>
              {captionShown < filteredCaptions.length && <div ref={captionSentinelRef} className="h-8" />}
            </>
          )}
        </div>

        <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
          <span className="text-[12px] text-muted">{filteredCaptions.length} styles</span>
          <button type="button" onClick={onClose} className="btn btn-primary min-w-28">Done</button>
        </div>
      </div>

      {/* nested filters sheet — mirrors the voice modal's Filters sheet */}
      {captionFiltersOpen && (
        <div className="absolute inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Close" onClick={() => setCaptionFiltersOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="disp text-[18px] font-semibold text-ink">Filters</h3>
                <button type="button" onClick={() => setCaptionFiltersOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
            </div>
            <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-ink">Style</div>
                <div className="flex flex-wrap gap-1.5">
                  {CAPTION_FAMILIES.map((f) => (
                    <button key={f.key} type="button" onClick={() => setCaptionFamily(captionFamily === f.label ? "" : f.label)} className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${captionFamily === f.label ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-ink">Font</div>
                <div className="flex flex-wrap gap-1.5">
                  {CAPTION_FONTS.map((f) => (
                    <button key={f} type="button" onClick={() => setCaptionFontF(captionFontF === f ? "" : f)} style={{ fontFamily: `"${f}", sans-serif` }} className={`rounded-full border px-3 py-1.5 text-[13px] transition ${captionFontF === f ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>{f}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-ink">Color</div>
                <div className="flex flex-wrap gap-2">
                  {CAPTION_COLORS.map((c) => (
                    <button key={c.hex} type="button" onClick={() => setCaptionColorF(captionColorF === c.hex ? "" : c.hex)} aria-label={c.name} title={c.name} className={`h-7 w-7 rounded-full border-2 transition ${captionColorF === c.hex ? "border-ink" : "border-hairline"}`} style={{ background: c.hex }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              <button type="button" onClick={() => { setCaptionFamily(""); setCaptionFontF(""); setCaptionColorF(""); }} className="rounded-full border border-hairline px-4 py-2 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink">
                Clear
              </button>
              <button type="button" onClick={() => setCaptionFiltersOpen(false)} className="btn btn-primary min-w-28">
                Apply ({filteredCaptions.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
