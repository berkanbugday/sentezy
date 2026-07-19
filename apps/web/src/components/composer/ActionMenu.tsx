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
};

/**
 * Small on-brand action menu (⋯ icon button → dropdown of labeled actions).
 * Copies Dropdown.tsx's outside-click-to-close pattern and visual language.
 */
export function ActionMenu({ items, onOpenChange }: { items: ActionMenuItem[]; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        aria-label="Diğer işlemler"
        title="Diğer işlemler"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-ink transition hover:bg-mist"
      >
        <Icon.more width={18} height={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[190px] overflow-hidden rounded-xl border border-hairline bg-paper py-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                it.onClick();
                if (!it.keepOpen) setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] font-medium transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40 ${it.danger ? "text-red-600" : "text-ink"}`}
            >
              <it.icon width={15} height={15} />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
