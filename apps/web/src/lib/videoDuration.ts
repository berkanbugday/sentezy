/** Milliseconds a duration must exceed to be usable, and the ceiling we accept for a
 *  brand intro/outro. An end longer than this is a video in its own right, not a bookend,
 *  and it would dominate the reel. */
export const MIN_CLIP_MS = 300;
export const MAX_CLIP_MS = 15_000;

export type ClipRejectReason = "unreadable" | "too_short" | "too_long";

export type ClipDurationResult = { ok: true; ms: number } | { ok: false; reason: ClipRejectReason };

/** Validate a measured duration (seconds, as a <video> reports it) into whole milliseconds.
 *
 *  Pure so it can be tested without a DOM. The strictness matters: this number delays the
 *  voiceover for the ENTIRE reel, so a NaN or Infinity — which a browser reports for a
 *  stream it cannot measure — must be rejected outright rather than defaulted to a guess. */
export function validateClipDuration(seconds: number): ClipDurationResult {
  if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, reason: "unreadable" };
  const ms = Math.round(seconds * 1000);
  if (ms < MIN_CLIP_MS) return { ok: false, reason: "too_short" };
  if (ms > MAX_CLIP_MS) return { ok: false, reason: "too_long" };
  return { ok: true, ms };
}

/** Measure a video file's duration in the browser. The result is stored with the clip so
 *  the preview and the renderer agree on its length without probing the file server-side. */
export function readClipDuration(file: File): Promise<ClipDurationResult> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const src = URL.createObjectURL(file);
    video.src = src;
    const done = (r: ClipDurationResult) => {
      URL.revokeObjectURL(src);
      resolve(r);
    };
    video.onloadedmetadata = () => done(validateClipDuration(video.duration));
    video.onerror = () => done({ ok: false, reason: "unreadable" });
  });
}

/** Turkish message for a rejected clip. Says what to do, not just what failed. */
export function clipErrorMessage(reason: ClipRejectReason): string {
  if (reason === "too_short") return "Video çok kısa — en az 0,3 saniye olmalı.";
  if (reason === "too_long") return "Video çok uzun — en fazla 15 saniye olabilir.";
  return "Video okunamadı. Başka bir dosya dene (.mp4 ya da .mov).";
}
