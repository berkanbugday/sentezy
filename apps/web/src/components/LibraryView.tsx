"use client";

import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { groupVideosByDay } from "@/lib/videoGroups";
import { useVideos } from "@/lib/queries";

const GRID_CLS = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4";

export function LibraryView() {
  const { data: videos, isLoading } = useVideos();
  const groups = videos ? groupVideosByDay(videos, new Date()) : [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="disp text-[28px] font-semibold text-ink">Your videos</h1>
          <p className="mt-1 text-[14.5px] text-slate">Everything you have made, newest first.</p>
        </div>
        <Link href="/dashboard" className="btn btn-primary">+ New video</Link>
      </div>

      {isLoading && (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading…</span>
          <div className={GRID_CLS}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="ph-stripe aspect-[9/16]" />
                <div className="p-3">
                  <div className="h-3.5 w-3/4 rounded bg-black/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {videos?.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="disp text-[18px] font-semibold text-ink">No videos yet</p>
          <p className="max-w-sm text-[14px] text-slate">Paste a product link or write a couple of sentences, and Sentezy makes the rest.</p>
          <Link href="/dashboard" className="btn btn-primary mt-1">Make your first video</Link>
        </div>
      )}

      {videos && videos.length > 0 && (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="mb-3 text-[13px] font-semibold text-muted">{g.label}</h2>
              <div className={GRID_CLS}>
                {g.videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
