"use client";

import { forwardRef, useState } from "react";

/**
 * Password input with a show/hide toggle. Forwards its ref so it works with
 * react-hook-form's `register` (spread `{...register("password")}` onto it).
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ className = "", ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={`${className} pr-10`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-ink"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c6 0 10 8 10 8a17 17 0 0 1-2.6 3.6M6.1 6.1A17 17 0 0 0 2 12s4 8 10 8a9.6 9.6 0 0 0 4.5-1.1" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            <path d="m3 3 18 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
});
