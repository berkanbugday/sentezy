"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement, SVGProps } from "react";
import { Icon } from "@/components/icons";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
  onClick: () => void;
  danger?: boolean;
  /** If true, clicking this item does not close the menu (e.g. a two-step confirm). */
  keepOpen?: boolean;
  disabled?: boolean;
  /** Current selection, shown right-aligned, muted and truncated (e.g. a picker's current value). */
  value?: string;
};

/**
 * Small on-brand action menu (⋯ icon button → dropdown of labeled actions).
 * Copies Dropdown.tsx's outside-click-to-close pattern and visual language.
 *
 * Below `sm:` the panel renders as a bottom sheet (same house pattern as the composer's
 * pickers — fixed backdrop + rounded-top sheet) so it can never run off the side of a narrow
 * viewport; from `sm:` up it's the original dropdown anchored under the trigger's right edge.
 */
export function ActionMenu({
  items,
  onOpenChange,
  label = "Diğer işlemler",
  disabled,
  title,
  icon: TriggerIcon = Icon.more,
}: {
  items: ActionMenuItem[];
  onOpenChange?: (open: boolean) => void;
  /** aria-label / tooltip for the trigger button. Defaults to "Diğer işlemler". */
  label?: string;
  /** Disables the trigger button itself. */
  disabled?: boolean;
  /** Trigger tooltip override — falls back to `label` when omitted. */
  title?: string;
  /** Trigger glyph. Defaults to the ⋯ "more" icon. */
  icon?: (p: SVGProps<SVGSVGElement>) => ReactElement;
}) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasValues = items.some((it) => it.value !== undefined);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-label={label}
        title={title ?? label}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
      >
        <TriggerIcon width={18} height={18} />
      </button>
      {open && (
        <>
          {/* mobile-only backdrop — the sm:+ anchored dropdown has none, it closes via the
             outside-click listener below instead */}
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm sm:hidden"
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-hairline bg-paper py-1 pb-[max(10px,env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-x-auto sm:inset-y-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-30 sm:mt-1 sm:max-h-none sm:overflow-hidden sm:rounded-xl sm:border sm:pb-1 sm:shadow-lg ${
              hasValues ? "sm:min-w-[260px]" : "sm:min-w-[190px]"
            }`}
          >
            <div className="mx-auto mb-1 mt-2 h-1 w-10 rounded-full bg-hairline sm:hidden" />
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  it.onClick();
                  if (!it.keepOpen) setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40 ${it.danger ? "text-red-600" : "text-ink"}`}
              >
                <it.icon width={15} height={15} className="shrink-0" />
                <span className="flex-1 truncate">{it.label}</span>
                {it.value !== undefined && (
                  <span className="max-w-[130px] truncate text-[12px] font-normal text-muted">{it.value}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
