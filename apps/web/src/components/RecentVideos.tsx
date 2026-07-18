"use client";

import Link from "next/link";
import { useVideos } from "@/lib/queries";
import { formatRatio, STATUS_LABEL } from "@/lib/types";
import { videoDisplayTitle } from "@/lib/videoTitle";

/** The dashboard "Son videoların" strip — the 4 most recent videos with real thumbnails. */
export function RecentVideos() {
  const { data: videos, isLoading } = useVideos();
  const recent = videos?.slice(0, 4) ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="ph-stripe aspect-[9/16]" />
            <div className="p-3">
              <div className="h-3.5 w-3/4 rounded bg-black/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recent.length === 0) {
    return (
      <div className="card px-6 py-10 text-center text-[14px] text-slate">
        Henüz video yok — ilk reelini oluştur.
      </div>
    );
  }

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
      {recent.map((v) => {
        const [label, cls] = STATUS_LABEL[v.status];
        return (
          <Link key={v.id} href={`/videos/${v.id}`} className="card overflow-hidden transition hover:-translate-y-0.5">
            <div className="ph-stripe relative aspect-[9/16]">
              {v.thumbnailUrl && (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <span className={`badge ${cls} absolute left-2.5 top-2.5`}>
                <span className="dot" />
                {label}
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-[13.5px] font-semibold text-ink">{videoDisplayTitle(v)}</p>
              <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                <span>{new Date(v.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
                <span className="mono">{formatRatio(v.aspectRatio)}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
