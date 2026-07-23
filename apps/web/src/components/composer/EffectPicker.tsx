"use client";

import { TRANSITIONS } from "@/components/WizardSteps";
import { Icon } from "@/components/icons";
import { EffectTile } from "./EffectTile";

/** Transition-effect picker for one clip boundary. `value` is the boundary's current
 *  incoming transition; `onSelect` sets it. */
export function EffectPicker({ open, onClose, value, onSelect, boundaryLabel }: { open: boolean; onClose: () => void; value: string; onSelect: (v: string) => void; boundaryLabel?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Transition</h3>
              {boundaryLabel && <p className="mt-0.5 text-[12px] text-muted">{boundaryLabel}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar overflow-y-auto px-5 py-4">
          {TRANSITIONS.map((g) => (
            <div key={g.group} className="mb-6 last:mb-0">
              <div className="mb-3 text-[14px] font-semibold text-ink">{g.group}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
                {g.items.map((it) => (
                  <EffectTile key={it.value} value={it.value} label={it.label} selected={value === it.value} onSelect={() => onSelect(it.value)} />
                ))}
              </div>
            </div>
          ))}
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
