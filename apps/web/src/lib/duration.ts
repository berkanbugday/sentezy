/** Render a video's duration as m:ss. Empty string when there is nothing to show —
 *  the card leaves the slot blank rather than inventing a value.
 *  `durationS` is a Prisma Decimal, which can arrive as a string over JSON. */
export function formatDuration(seconds: number | null | undefined): string {
  const n = typeof seconds === "string" ? Number.parseFloat(seconds) : seconds;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "";
  const total = Math.round(n);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
