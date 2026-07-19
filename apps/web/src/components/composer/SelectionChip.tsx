"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

/**
 * A pill for one active composer selection (avatar / voice / music / caption): a small visual
 * identifier + a truncated label. Clicking the body reopens that picker so the choice can be
 * changed directly, without going back through the "+" menu. An optional trailing `×` clears the
 * selection — kept as a separate focusable control (own aria-label, stops propagation) so it
 * never also triggers the open action. Omit `onClear` for selections that can't be unset (voice).
 */
export function SelectionChip({
  onOpen,
  onClear,
  clearLabel,
  visual,
  children,
}: {
  onOpen: () => void;
  onClear?: () => void;
  clearLabel?: string;
  visual: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex max-w-[200px] items-center gap-0.5 rounded-full border border-hairline bg-paper py-1 pl-1 pr-1 text-[13px] font-medium text-ink sm:max-w-[260px]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 text-left transition hover:bg-mist"
      >
        {visual}
        <span className="min-w-0 truncate">{children}</span>
      </button>
      {onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={clearLabel}
          className="-m-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-muted transition hover:bg-mist hover:text-ink"
        >
          <Icon.close width={11} height={11} />
        </button>
      )}
    </span>
  );
}
