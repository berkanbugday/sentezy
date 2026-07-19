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
  icon: TriggerIcon = Icon.plus,
  size = "sm",
  badge,
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
  /** "sm" (default) keeps the original compact trigger/panel — used by the video detail
   *  screen's `⋯` menu. "lg" is the composer's larger touch-friendly control row. */
  size?: "sm" | "lg";
  /** Count bubble rendered on the trigger's top-right corner. Omit or pass 0 to render nothing. */
  badge?: number;
}) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasValues = items.some((it) => it.value !== undefined);
  const lg = size === "lg";

  // A ref (not the raw prop) so the listeners below always call the LATEST onOpenChange,
  // even though they're only re-registered when `open` changes, not on every render.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChangeRef.current?.(next);
  };

  useEffect(() => {
    // Nothing to listen for while closed — also means these never fire a spurious
    // setOpen(false) when the menu is already closed.
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Return focus to the trigger whenever the menu transitions from open → closed (Escape,
  // outside click, or an item's own onClick), mirroring the drawer it replaced.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (wasOpenRef.current && !open) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-label={badge ? `${label} (${badge} seçili)` : label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title ?? label}
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45 ${lg ? "h-11 w-11" : "h-10 w-10"
          }`}
      >
        <TriggerIcon width={lg ? 21 : 18} height={lg ? 21 : 18} />
        {!!badge && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-paper ring-2 ring-paper"
          >
            {badge}
          </span>
        )}
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
            className={`fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-hairline bg-paper py-1 pb-[max(10px,env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-x-auto sm:inset-y-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-30 sm:mt-1 sm:max-h-none sm:overflow-hidden sm:rounded-xl sm:border sm:pb-1 sm:shadow-lg ${lg
                ? hasValues
                  ? "sm:min-w-[300px]"
                  : "sm:min-w-[230px]"
                : hasValues
                  ? "sm:min-w-[260px]"
                  : "sm:min-w-[190px]"
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
                className={`flex w-full items-center text-left font-medium transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40 ${lg ? "gap-3 px-4 py-3 text-[15px]" : "gap-2.5 px-3.5 py-2.5 text-[13.5px]"
                  } ${it.danger ? "text-red-600" : "text-ink"}`}
              >
                <it.icon width={lg ? 18 : 15} height={lg ? 18 : 15} className="shrink-0" />
                <span className="flex-1 truncate">{it.label}</span>
                {it.value !== undefined && (
                  <span className={`truncate font-normal text-muted ${lg ? "max-w-[150px] text-[13.5px]" : "max-w-[130px] text-[12px]"}`}>{it.value}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
