"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

/** Small on-brand dropdown menu (replaces native <select> so the caret has room). */
export function Dropdown({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = options.find((o) => o.v === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1.5 pl-3.5 pr-3 text-[12px] font-medium text-slate transition hover:bg-mist">
        {current?.label ?? ""}
        <Icon.chevronDown width={13} height={13} className="text-muted" />
      </button>
      {open && (
        <div className="no-scrollbar absolute left-0 top-full z-30 mt-1 max-h-56 min-w-[140px] overflow-y-auto rounded-xl border border-hairline bg-paper py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => {
                onChange(o.v);
                setOpen(false);
              }}
              className={`block w-full whitespace-nowrap px-3 py-1.5 text-left text-[12.5px] transition hover:bg-mist ${o.v === value ? "font-semibold text-ink" : "text-slate"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
