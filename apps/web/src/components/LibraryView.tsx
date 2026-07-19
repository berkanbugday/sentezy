"use client";

import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/lib/queries";

export function LibraryView() {
  const { data: videos, isLoading } = useVideos();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="disp text-[28px] font-semibold text-ink">Videolarım</h1>
          <p className="mt-1 text-[14.5px] text-slate">Oluşturduğun tüm videolar.</p>
        </div>
        <Link href="/dashboard" className="btn btn-primary">+ Yeni video</Link>
      </div>

      {isLoading && <p className="text-[14px] text-muted">Yükleniyor…</p>}

      {videos?.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="disp text-[18px] font-semibold text-ink">Henüz video yok</p>
          <p className="max-w-sm text-[14px] text-slate">İlk reelini oluştur — bir senaryo yaz, avatar ve ses seç.</p>
          <Link href="/dashboard" className="btn btn-primary mt-1">İlk videonu oluştur</Link>
        </div>
      )}

      {videos && videos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
