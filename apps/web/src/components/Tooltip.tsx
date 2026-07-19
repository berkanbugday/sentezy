"use client";

import { cloneElement, isValidElement, type ReactElement, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Side = "right" | "top" | "bottom" | "left";

/** Lightweight, on-brand tooltip. Wraps a single element and renders the label in
 *  a portal on <body> — so it escapes any `overflow` clipping (e.g. the sidebar).
 *  Shows on hover and keyboard focus. Pass `disabled` to suppress it (e.g. when a
 *  label is already visible in the expanded sidebar). */
export function Tooltip({
  label,
  side = "right",
  disabled = false,
  delay = 250,
  children,
}: {
  label: ReactNode;
  side?: Side;
  disabled?: boolean;
  delay?: number;
  children: ReactElement;
}) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; transform: string } | null>(null);
  // Stable id linking the trigger to the portalled tooltip, so screen readers announce the
  // label too (a disabled button inside a wrapper span otherwise gets no accessible name).
  const tooltipId = useId();

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => () => clear(), [clear]);

  const show = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const map: Record<Side, { left: number; top: number; transform: string }> = {
      right: { left: r.right + gap, top: r.top + r.height / 2, transform: "translateY(-50%)" },
      left: { left: r.left - gap, top: r.top + r.height / 2, transform: "translate(-100%,-50%)" },
      top: { left: r.left + r.width / 2, top: r.top - gap, transform: "translate(-50%,-100%)" },
      bottom: { left: r.left + r.width / 2, top: r.bottom + gap, transform: "translate(-50%,0)" },
    };
    setPos(map[side]);
  }, [side]);

  const open = useCallback(() => {
    if (disabled) return;
    clear();
    timer.current = setTimeout(show, delay);
  }, [disabled, delay, show, clear]);

  const close = useCallback(() => {
    clear();
    setPos(null);
  }, [clear]);

  if (!isValidElement(children)) return children;

  const props = children.props as Record<string, unknown> & {
    onMouseEnter?: (e: unknown) => void;
    onMouseLeave?: (e: unknown) => void;
    onFocus?: (e: unknown) => void;
    onBlur?: (e: unknown) => void;
  };

  const trigger = cloneElement(children, {
    ref: (n: HTMLElement | null) => {
      nodeRef.current = n;
    },
    ...(disabled ? {} : { "aria-describedby": tooltipId }),
    onMouseEnter: (e: unknown) => {
      props.onMouseEnter?.(e);
      open();
    },
    onMouseLeave: (e: unknown) => {
      props.onMouseLeave?.(e);
      close();
    },
    onFocus: (e: unknown) => {
      props.onFocus?.(e);
      open();
    },
    onBlur: (e: unknown) => {
      props.onBlur?.(e);
      close();
    },
  } as Record<string, unknown>);

  return (
    <>
      {trigger}
      {pos != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div id={tooltipId} role="tooltip" className="tooltip" style={{ left: pos.left, top: pos.top, transform: pos.transform }}>
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
