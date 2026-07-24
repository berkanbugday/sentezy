"use client";

import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/lib/queries";

/** The dashboard "Recent" strip — the 4 most recent videos with real thumbnails. */
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
        Nothing here yet — your videos will appear as you make them.
      </div>
    );
  }

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
      {recent.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}
