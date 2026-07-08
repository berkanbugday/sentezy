import type { SVGProps } from "react";

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  home: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
  ),
  video: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="3" y="6" width="14" height="12" rx="2" /><path d="m17 10 4-2v8l-4-2" /></svg>
  ),
  users: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" /></svg>
  ),
  grid: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
  ),
  box: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 3 20 7v10l-8 4-8-4V7z" /><path d="M4 7l8 4 8-4M12 11v10" /></svg>
  ),
  card: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>
  ),
  settings: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L3.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" /></svg>
  ),
  plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  search: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
  ),
  bell: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.5 21a1.7 1.7 0 0 0 3 0" /></svg>
  ),
  sun: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>
  ),
  menu: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
  ),
  bolt: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
  ),
  clock: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
};
