import type { ApiVideo } from "./types";

export type VideoGroup = { key: string; label: string; videos: ApiVideo[] };

/** Midnight (local time) for the given instant — the boundary a "day" is measured against. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Group videos under a heading per calendar day (local timezone), newest day first.
 *  `videos` must already be sorted newest-first (the API returns them that way) — this
 *  only partitions them into day buckets, it never reorders. `now` is passed in rather
 *  than read from the clock so callers (and tests) stay deterministic.
 *
 *  Days are compared by local calendar date, not by dividing elapsed milliseconds by
 *  86_400_000 — that epoch-day math is anchored to UTC midnight, which drifts away from
 *  local midnight in every non-UTC timezone and mis-groups videos that straddle it. */
export function groupVideosByDay(videos: ApiVideo[], now: Date): VideoGroup[] {
  const today = startOfDay(now);
  const groups: VideoGroup[] = [];
  const byKey = new Map<string, VideoGroup>();

  for (const video of videos) {
    const day = startOfDay(new Date(video.createdAt));
    const key = dayKey(day);

    let group = byKey.get(key);
    if (!group) {
      const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
      const label =
        diffDays === 0
          ? "Today"
          : diffDays === 1
            ? "Yesterday"
            : day.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      group = { key, label, videos: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.videos.push(video);
  }

  return groups;
}
