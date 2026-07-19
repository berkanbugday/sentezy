"use client";

import Link from "next/link";
import { formatDuration } from "@/lib/duration";
import { STATUS_LABEL, type ApiVideo } from "@/lib/types";
import { videoDisplayTitle } from "@/lib/videoTitle";

/** One video tile — used by both the library grid and the dashboard "son videolar" strip.
 *  The metadata row shows the duration only once a render is ready; while processing the
 *  slot stays empty (the date holds the row height, so nothing shifts when it lands). */
export function VideoCard({ video }: { video: ApiVideo }) {
  const [label, cls] = STATUS_LABEL[video.status];
  const duration = video.status === "ready" ? formatDuration(video.durationS) : "";

  return (
    <Link href={`/videos/${video.id}`} className="card overflow-hidden transition hover:-translate-y-0.5">
      <div className="ph-stripe relative aspect-[9/16]">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className={`badge ${cls} absolute left-2.5 top-2.5`}>
          <span className="dot" />
          {label}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-[13.5px] font-semibold text-ink">{videoDisplayTitle(video)}</p>
        <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
          <span>{new Date(video.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
          <span className="mono">{duration}</span>
        </div>
      </div>
    </Link>
  );
}
