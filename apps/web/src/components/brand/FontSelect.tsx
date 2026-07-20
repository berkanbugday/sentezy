"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

/** Font picker that renders every option in its own face — you pick a typeface by seeing
 *  it, not by reading its name. A menu rather than a row of pills: thirteen pills set in
 *  thirteen different faces is the noisiest thing on the page, and this is a decision made
 *  once, not something to keep in view. */
export function FontSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-left text-[14px] text-ink transition hover:border-slate focus:border-signal focus:outline-none"
      >
        <span style={{ fontFamily: `"${value}", sans-serif` }}>{value}</span>
        <Icon.chevronDown width={14} height={14} className="flex-none text-muted" />
      </button>
      {open && (
        <div
          role="listbox"
          className="no-scrollbar absolute right-0 top-full z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-hairline bg-paper py-1 shadow-lg"
        >
          {options.map((f) => (
            <button
              key={f}
              type="button"
              role="option"
              aria-selected={f === value}
              onClick={() => {
                onChange(f);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[14px] transition hover:bg-mist ${
                f === value ? "text-ink" : "text-slate"
              }`}
              style={{ fontFamily: `"${f}", sans-serif` }}
            >
              {f}
              {f === value && <Icon.check width={14} height={14} className="flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
