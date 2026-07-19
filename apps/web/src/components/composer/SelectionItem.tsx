"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

/**
 * One active composer selection (avatar / voice / music / caption), rendered as plain
 * underlined text — no pill, no border, no background. A small visual identifier sits in
 * front of the label; clicking the label (which reads like a link, underlined) reopens that
 * picker so the choice can be changed directly, without going back through the "+" menu. A
 * trailing `×` clears the selection — kept as a separate focusable control (own aria-label,
 * stops propagation) so it never also triggers the open action. Omit `onClear` for selections
 * that can't be unset.
 */
export function SelectionItem({
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
    <span className="inline-flex max-w-[220px] items-center gap-1.5 text-[13.5px] font-medium text-ink sm:max-w-[280px]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {visual}
        <span className="min-w-0 truncate underline decoration-muted/50 underline-offset-4 transition hover:decoration-ink">{children}</span>
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
