"use client";

import Link from "next/link";
import { useVideos } from "@/lib/queries";
import { STATUS_LABEL } from "@/lib/types";

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((v) => {
            const [label, cls] = STATUS_LABEL[v.status];
            const href = `/videos/${v.id}`;
            return (
              <Link key={v.id} href={href} className="card overflow-hidden transition hover:-translate-y-0.5">
                <div className="ph-stripe relative aspect-[9/16]">
                  <span className={`badge ${cls} absolute left-2.5 top-2.5`}>
                    <span className="dot" />
                    {label}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{v.title}</p>
                  <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                    <span>{new Date(v.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
                    <span className="mono">{v.aspectRatio}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
