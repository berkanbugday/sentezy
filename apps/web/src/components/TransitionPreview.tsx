"use client";

import { useEffect, useRef } from "react";

// Per-frame, faithful reproduction of the ffmpeg xfade families using Canvas 2D and
// the user's two real frames — alpha blend (fade), push (slide), clip (wipe/circle/
// box/diag), scale (zoom). Approximated families fall back to the closest real one.

type Fam =
  | { t: "cut" }
  | { t: "fade" }
  | { t: "fadecolor"; color: string }
  | { t: "slide"; dir: "l" | "r" | "u" | "d" }
  | { t: "wipe"; dir: "l" | "r" | "u" | "d" }
  | { t: "circleopen" }
  | { t: "circleclose" }
  | { t: "box" }
  | { t: "zoom" }
  | { t: "diag"; dir: "tl" | "tr" | "bl" | "br" }
  | { t: "zoompunch" }
  | { t: "shake" }
  | { t: "glitch" }
  | { t: "whip" };

function fam(v: string): Fam {
  if (v === "cut") return { t: "cut" };
  if (v === "zoompunch") return { t: "zoompunch" };
  if (v === "shake") return { t: "shake" };
  if (v === "glitch") return { t: "glitch" };
  if (v === "whip") return { t: "whip" };
  if (v === "flash" || v === "fadewhite") return { t: "fadecolor", color: "#fff" };
  if (v === "fadeblack") return { t: "fadecolor", color: "#000" };
  if (v === "fadegrays") return { t: "fadecolor", color: "#808080" };
  if (/(tl|tr|bl|br)$/.test(v)) return { t: "diag", dir: v.slice(-2) as "tl" };
  if (v.startsWith("circle")) return { t: v.includes("close") ? "circleclose" : "circleopen" };
  if (["rectcrop", "horzopen", "horzclose", "vertopen", "vertclose"].includes(v)) return { t: "box" };
  if (["zoomin", "distance", "squeezev", "squeezeh"].includes(v)) return { t: "zoom" };
  const slide = v.startsWith("slide") || v.startsWith("smooth");
  const wipe = v.startsWith("wipe") || v.endsWith("slice");
  if (slide || wipe) {
    let dir: "l" | "r" | "u" | "d" = "l";
    if (v.includes("right") || v.startsWith("hr")) dir = "r";
    else if (v.includes("up") || v.startsWith("vu")) dir = "u";
    else if (v.includes("down") || v.startsWith("vd")) dir = "d";
    else if (v.includes("left") || v.startsWith("hl")) dir = "l";
    return { t: slide ? "slide" : "wipe", dir };
  }
  return { t: "fade" };
}

type Img = HTMLImageElement | HTMLCanvasElement | null;

// Two visually DISTINCT demo frames so every transition's motion is obvious (two
// similar photos make all effects look identical). Built once, on the client.
let demoA: HTMLCanvasElement | null = null;
let demoB: HTMLCanvasElement | null = null;
function demos(): { a: Img; b: Img } {
  if (demoA && demoB) return { a: demoA, b: demoB };
  const mk = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d");
    if (ctx) paint(ctx);
    return c;
  };
  // Monochrome, on-brand: a light frame (mist → hairline gray, slate circle) and a
  // dark frame (Sentezy ink/charcoal beam, muted-gray hills). The light↔dark contrast
  // keeps every transition legible without breaking the palette.
  demoA = mk((ctx) => {
    const g = ctx.createLinearGradient(0, 0, 320, 180);
    g.addColorStop(0, "#f4f4f5");
    g.addColorStop(1, "#d4d4d8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "rgba(82,82,91,0.55)"; // slate
    ctx.beginPath();
    ctx.arc(66, 50, 30, 0, Math.PI * 2);
    ctx.fill();
  });
  demoB = mk((ctx) => {
    const g = ctx.createLinearGradient(0, 0, 320, 180);
    g.addColorStop(0, "#3f3f46");
    g.addColorStop(1, "#18181b"); // --beam (ink)
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "rgba(161,161,170,0.5)"; // muted
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(110, 112);
    ctx.lineTo(210, 146);
    ctx.lineTo(320, 116);
    ctx.lineTo(320, 180);
    ctx.closePath();
    ctx.fill();
  });
  return { a: demoA, b: demoB };
}

function cover(ctx: CanvasRenderingContext2D, img: Img, dx: number, dy: number, dw: number, dh: number) {
  if (!img || !img.width) {
    ctx.fillStyle = "#e5e5ea";
    ctx.fillRect(dx, dy, dw, dh);
    return;
  }
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > dr) {
    sh = img.height;
    sw = sh * dr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function draw(ctx: CanvasRenderingContext2D, a: Img, b: Img, v: string, p: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const f = fam(v);
  switch (f.t) {
    case "cut":
      cover(ctx, p < 0.5 ? a : b, 0, 0, w, h);
      break;
    case "fade":
      cover(ctx, a, 0, 0, w, h);
      ctx.globalAlpha = p;
      cover(ctx, b, 0, 0, w, h);
      ctx.globalAlpha = 1;
      break;
    case "fadecolor":
      if (p < 0.5) {
        cover(ctx, a, 0, 0, w, h);
        ctx.globalAlpha = Math.min(1, 2 * p);
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = Math.min(1, 2 * (p - 0.5));
        cover(ctx, b, 0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      break;
    case "slide":
      if (f.dir === "l") {
        cover(ctx, a, -p * w, 0, w, h);
        cover(ctx, b, (1 - p) * w, 0, w, h);
      } else if (f.dir === "r") {
        cover(ctx, a, p * w, 0, w, h);
        cover(ctx, b, -(1 - p) * w, 0, w, h);
      } else if (f.dir === "u") {
        cover(ctx, a, 0, -p * h, w, h);
        cover(ctx, b, 0, (1 - p) * h, w, h);
      } else {
        cover(ctx, a, 0, p * h, w, h);
        cover(ctx, b, 0, -(1 - p) * h, w, h);
      }
      break;
    case "wipe":
      cover(ctx, a, 0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      if (f.dir === "l") ctx.rect((1 - p) * w, 0, p * w, h);
      else if (f.dir === "r") ctx.rect(0, 0, p * w, h);
      else if (f.dir === "u") ctx.rect(0, (1 - p) * h, w, p * h);
      else ctx.rect(0, 0, w, p * h);
      ctx.clip();
      cover(ctx, b, 0, 0, w, h);
      ctx.restore();
      break;
    case "circleopen":
      cover(ctx, a, 0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (p * Math.hypot(w, h)) / 2, 0, Math.PI * 2);
      ctx.clip();
      cover(ctx, b, 0, 0, w, h);
      ctx.restore();
      break;
    case "circleclose":
      cover(ctx, b, 0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ((1 - p) * Math.hypot(w, h)) / 2, 0, Math.PI * 2);
      ctx.clip();
      cover(ctx, a, 0, 0, w, h);
      ctx.restore();
      break;
    case "box":
      cover(ctx, a, 0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(((1 - p) * w) / 2, ((1 - p) * h) / 2, p * w, p * h);
      ctx.clip();
      cover(ctx, b, 0, 0, w, h);
      ctx.restore();
      break;
    case "zoom": {
      cover(ctx, a, 0, 0, w, h);
      const s = 1.4 - 0.4 * p;
      const bw = w * s;
      const bh = h * s;
      ctx.globalAlpha = p;
      cover(ctx, b, (w - bw) / 2, (h - bh) / 2, bw, bh);
      ctx.globalAlpha = 1;
      break;
    }
    case "diag": {
      cover(ctx, a, 0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      const s = p * 2;
      if (f.dir === "tl") {
        ctx.moveTo(0, 0);
        ctx.lineTo(w * s, 0);
        ctx.lineTo(0, h * s);
      } else if (f.dir === "tr") {
        ctx.moveTo(w, 0);
        ctx.lineTo(w - w * s, 0);
        ctx.lineTo(w, h * s);
      } else if (f.dir === "bl") {
        ctx.moveTo(0, h);
        ctx.lineTo(w * s, h);
        ctx.lineTo(0, h - h * s);
      } else {
        ctx.moveTo(w, h);
        ctx.lineTo(w - w * s, h);
        ctx.lineTo(w, h - h * s);
      }
      ctx.closePath();
      ctx.clip();
      cover(ctx, b, 0, 0, w, h);
      ctx.restore();
      break;
    }
    case "zoompunch": {
      if (p < 0.18) {
        cover(ctx, a, 0, 0, w, h);
        break;
      }
      const q = (p - 0.18) / 0.82;
      const s = 1.35 - 0.35 * q;
      cover(ctx, b, (w - w * s) / 2, (h - h * s) / 2, w * s, h * s);
      break;
    }
    case "shake": {
      if (p < 0.15) {
        cover(ctx, a, 0, 0, w, h);
        break;
      }
      const q = (p - 0.15) / 0.85;
      const amp = 15 * (1 - q);
      const dx = amp * Math.sin(q * 34);
      const dy = amp * 0.7 * Math.cos(q * 30);
      cover(ctx, b, dx - w * 0.03, dy - h * 0.03, w * 1.06, h * 1.06);
      break;
    }
    case "glitch": {
      if (p < 0.12) {
        cover(ctx, a, 0, 0, w, h);
        break;
      }
      const q = (p - 0.12) / 0.88;
      const off = 11 * (1 - q);
      cover(ctx, b, 0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.45 * (1 - q);
      cover(ctx, b, off, -2, w, h);
      cover(ctx, b, -off, 2, w, h);
      ctx.restore();
      break;
    }
    case "whip": {
      ctx.save();
      ctx.filter = `blur(${(7 * (1 - Math.abs(p - 0.5) * 2)).toFixed(1)}px)`;
      cover(ctx, a, -p * w, 0, w, h);
      cover(ctx, b, (1 - p) * w, 0, w, h);
      ctx.filter = "none";
      ctx.restore();
      break;
    }
  }
}

const DUR = 1200;
const HOLD = 420;
const ease = (p: number) => p * p * (3 - 2 * p);

// One shared rAF clock drives every mini preview (so a grid of 40 doesn't spin up
// 40 loops). Subscribers get the timestamp; the loop stops when none are left.
type Cb = (t: number) => void;
const subs = new Set<Cb>();
let rafId = 0;
function loop(t: number) {
  subs.forEach((fn) => fn(t));
  rafId = subs.size ? requestAnimationFrame(loop) : 0;
}
function subscribe(fn: Cb) {
  subs.add(fn);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => {
    subs.delete(fn);
    if (!subs.size && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

/** Canvas preview of `value`. Static by default (one mid-transition frame); when `play`
 *  is true it animates on the shared ping-pong clock. Only playing instances subscribe,
 *  so the rAF loop idles when nothing is hovered/selected. */
export function EffectPreview({ value, width = 300, height = 170, play = false }: { value: string; width?: number; height?: number; play?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const { a, b } = demos();
    const paint = (p: number) => {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) draw(ctx, a, b, value, ease(p), c.width, c.height);
      }
    };
    if (!play) {
      // Static: a single mid-transition frame so the effect's character reads.
      paint(0.5);
      return;
    }
    let start = 0;
    const cycle = HOLD + DUR + HOLD + DUR;
    const cb = (t: number) => {
      if (!start) start = t;
      const e = (t - start) % cycle;
      let p: number;
      if (e < HOLD) p = 0;
      else if (e < HOLD + DUR) p = (e - HOLD) / DUR;
      else if (e < HOLD + DUR + HOLD) p = 1;
      else p = 1 - (e - HOLD - DUR - HOLD) / DUR;
      paint(p);
    };
    return subscribe(cb);
  }, [value, play]);

  return <canvas ref={canvasRef} width={width} height={height} className="h-full w-full object-cover" />;
}
