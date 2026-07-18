"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { qk, useVideo } from "@/lib/queries";
import { formatRatio, STAGE_LABEL, STATUS_LABEL, type VideoStage, type VideoStatus } from "@/lib/types";
import { videoDisplayTitle } from "@/lib/videoTitle";

type Live = { status: VideoStatus; stage: VideoStage; progress: number };

export function VideoDetail({ id }: { id: string }) {
  const { data: detail, isError } = useVideo(id);
  const queryClient = useQueryClient();
  const [liveOverride, setLiveOverride] = useState<Live | null>(null);

  // Live progress via Supabase Realtime; a terminal status refetches full detail.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`video-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "videos", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as Live;
          setLiveOverride({ status: row.status, stage: row.stage, progress: row.progress });
          if (row.status === "ready" || row.status === "failed") queryClient.invalidateQueries({ queryKey: qk.video(id) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  if (isError) return <p className="text-[14px] text-muted">Video bulunamadı.</p>;
  if (!detail) return <p className="text-[14px] text-muted">Yükleniyor…</p>;

  const v = detail.video;
  const title = videoDisplayTitle(v);
  const live: Live = liveOverride ?? { status: v.status, stage: v.stage, progress: v.progress };
  const [label, cls] = STATUS_LABEL[live.status];
  const processing = live.status === "queued" || live.status === "processing";
  const ratioClass =
    v.aspectRatio === "16:9" ? "aspect-video" : v.aspectRatio === "1:1" ? "aspect-square" : "aspect-[9/16]";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/library" className="text-[13.5px] font-medium text-signal">← Videolarım</Link>
      <h1 className="disp mt-3 text-[24px] font-semibold leading-tight text-ink">{title}</h1>
      <div className="mt-2">
        <span className={`badge ${cls}`}>
          <span className="dot" />
          {label}
        </span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[340px_1fr]">
        <div className={`card relative mx-auto w-full max-w-[340px] overflow-hidden ${ratioClass}`}>
          {detail.downloadUrl ? (
            <video src={detail.downloadUrl} controls poster={detail.thumbnailUrl ?? undefined} className="h-full w-full object-cover" />
          ) : (
            <div className="ph-stripe flex h-full w-full items-center justify-center p-6 text-center">
              {live.status === "failed" ? (
                <span className="text-[13px] text-red-600">Üretim başarısız oldu.</span>
              ) : (
                <span className="text-[13px] text-muted">{STAGE_LABEL[live.stage ?? ""] ?? "Sıraya alındı"}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {processing && (
            <div className="card p-5">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">{STAGE_LABEL[live.stage ?? ""] ?? "Sıraya alındı"}</span>
                <span className="mono text-muted">{live.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-mist">
                <div className="grad h-full rounded-full transition-all duration-500" style={{ width: `${live.progress}%` }} />
              </div>
            </div>
          )}

          <div className="card p-5 text-[14px]">
            {(
              [
                ["En-boy oranı", formatRatio(v.aspectRatio)],
                ["Süre", v.durationS ? `${Math.round(v.durationS)} sn` : "—"],
                ["Oluşturuldu", new Date(v.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })],
              ] as [string, string][]
            ).map(([k, val]) => (
              <div key={k} className="flex justify-between border-b border-hairline py-2 last:border-0">
                <span className="text-muted">{k}</span>
                <span className="font-semibold text-ink">{val}</span>
              </div>
            ))}
          </div>

          {detail.downloadUrl && (
            <div className="flex flex-wrap gap-2">
              {/* fileDownloadUrl carries Content-Disposition: attachment → the browser saves it. */}
              <a href={detail.fileDownloadUrl ?? detail.downloadUrl} className="btn btn-primary w-fit">İndir</a>
              <a
                href={detail.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center rounded-full border border-hairline bg-paper px-4 py-2 text-[14px] font-medium text-ink transition hover:bg-mist"
              >
                Yeni sekmede aç
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
