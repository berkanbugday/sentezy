"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

/** A `card` whose body is hidden behind a clickable header until the user opens it. */
export function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-mist"
      >
        <span className="text-[13px] font-medium text-muted">{title}</span>
        <span className="flex items-center gap-2">
          {summary && <span className="text-[13px] text-muted">{summary}</span>}
          <Icon.chevronDown
            width={15}
            height={15}
            className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className="border-t border-hairline p-5">{children}</div>}
    </div>
  );
}
