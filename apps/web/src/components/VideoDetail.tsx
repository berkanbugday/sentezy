"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readAvatarPosition } from "@sentezy/types";
import { VOICE_EMOTIONS } from "@/components/wizard/constants";
import { CAPTION_FAMILIES } from "@/lib/captionStyles";
import { formatDuration } from "@/lib/duration";
import { createClient } from "@/lib/supabase/client";
import { qk, useDeleteVideo, useRenameVideo, useVideo } from "@/lib/queries";
import { formatRatio, STAGE_LABEL, STATUS_LABEL, type VideoStage, type VideoStatus } from "@/lib/types";
import { videoDisplayTitle } from "@/lib/videoTitle";

type Live = { status: VideoStatus; stage: VideoStage; progress: number };

export function VideoDetail({ id }: { id: string }) {
  const { data: detail, isError } = useVideo(id);
  const queryClient = useQueryClient();
  const [liveOverride, setLiveOverride] = useState<Live | null>(null);
  const router = useRouter();
  const rename = useRenameVideo(id);
  const remove = useDeleteVideo(id);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    };
  }, []);

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

  const opts = (v.options ?? {}) as {
    captions?: { style?: string; font?: string; color?: string };
    layout?: { avatarPosition?: string; captionPosition?: string };
    music?: { trackKey?: string; volume?: number };
    voice?: { emotion?: string };
  };
  // Videos created before the settings cleanup stored avatarLayout+avatarSide; the shared
  // reader maps those forward, so old and new videos both display correctly.
  const AVATAR_POS_LABEL: Record<string, string> = { left: "Sol", center: "Orta", right: "Sağ" };
  const avatarPos = AVATAR_POS_LABEL[readAvatarPosition(opts.layout)];
  // The detail screen wants a human label, not a preset id — look the family up directly
  // and append the font, e.g. "Vurgu · Poppins".
  const fam = CAPTION_FAMILIES.find((f) => f.key === opts.captions?.style);
  const captionName = fam ? [fam.label, opts.captions?.font].filter(Boolean).join(" · ") : null;
  const emotionLabel = opts.voice
    ? VOICE_EMOTIONS.find((e) => e.value === (opts.voice?.emotion ?? ""))?.label ?? null
    : null;
  const scriptText = (v.script ?? "").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/library" className="text-[13.5px] font-medium text-signal">← Videolarım</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(false);
                    if (e.key === "Enter" && draftTitle.trim()) {
                      rename.mutate(draftTitle.trim(), { onSuccess: () => setEditing(false) });
                    }
                  }}
                  maxLength={120}
                  className="w-full rounded-lg border border-hairline bg-paper px-3 py-1.5 text-[20px] font-semibold text-ink outline-none focus:border-signal"
                />
                <button
                  type="button"
                  disabled={!draftTitle.trim() || rename.isPending}
                  onClick={() => rename.mutate(draftTitle.trim(), { onSuccess: () => setEditing(false) })}
                  className="btn btn-primary shrink-0"
                >
                  Kaydet
                </button>
                <button type="button" onClick={() => setEditing(false)} className="shrink-0 text-[13.5px] text-muted">
                  Vazgeç
                </button>
              </div>
              {rename.isError && (
                <p className="mt-1 text-[12.5px] text-red-600">Başlık kaydedilemedi — video silinmiş olabilir.</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(title);
                setEditing(true);
              }}
              className="disp text-left text-[24px] font-semibold leading-tight text-ink hover:text-signal"
              title="Başlığı düzenle"
            >
              {title}
            </button>
          )}
          <div className="mt-2">
            <span className={`badge ${cls}`}>
              <span className="dot" />
              {label}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard?reuse=${v.id}`)}
            className="inline-flex items-center rounded-full border border-hairline bg-paper px-4 py-2 text-[14px] font-medium text-ink transition hover:bg-mist"
          >
            Yeniden kullan
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
                confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 4000);
                return;
              }
              // A 404 means it is already gone (deleted in another tab) — the destination
              // is the same either way, so treat both outcomes as "leave".
              remove.mutate(undefined, { onSuccess: () => router.push("/library"), onError: () => router.push("/library") });
            }}
            className="inline-flex items-center rounded-full border border-hairline bg-paper px-4 py-2 text-[14px] font-medium text-red-600 transition hover:bg-mist"
          >
            {confirmDelete ? "Emin misiniz?" : "Sil"}
          </button>
        </div>
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
                ["Avatar", detail.avatar?.name ?? null],
                ["Ses", detail.voice?.label ?? null],
                ["Alt yazı", captionName],
                ["Duygu", emotionLabel],
                ["En-boy oranı", formatRatio(v.aspectRatio)],
                ["Süre", formatDuration(v.durationS) || "—"],
                [
                  "Yerleşim",
                  detail.avatar
                    ? `Avatar ${avatarPos} · alt yazı ${opts.layout?.captionPosition === "top" ? "üstte" : "altta"}`
                    : `Alt yazı ${opts.layout?.captionPosition === "top" ? "üstte" : "altta"}`,
                ],
                ["Müzik", opts.music?.trackKey ? `${opts.music.trackKey} · %${Math.round((opts.music.volume ?? 0) * 100)}` : null],
                ["Kredi", v.status !== "draft" && v.creditsCost ? String(v.creditsCost) : null],
                ["Oluşturuldu", new Date(v.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })],
              ] as [string, string | null][]
            )
              .filter((row): row is [string, string] => row[1] !== null)
              .map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-hairline py-2 last:border-0">
                  <span className="shrink-0 text-muted">{k}</span>
                  <span className="truncate text-right font-semibold text-ink">{val}</span>
                </div>
              ))}
          </div>

          {detail.avatar?.imageUrl && (
            <div className="card flex items-center gap-3 p-4">
              <img src={detail.avatar.imageUrl} alt="" className="h-14 w-14 rounded-lg bg-mist object-cover" />
              <div className="min-w-0">
                <p className="text-[13px] text-muted">Avatar</p>
                <p className="truncate text-[14px] font-semibold text-ink">{detail.avatar.name}</p>
              </div>
            </div>
          )}

          {scriptText && (
            <div className="card p-5">
              <p className="mb-2 text-[13px] text-muted">Metin</p>
              <p className="text-[14px] leading-relaxed text-ink">{scriptText}</p>
            </div>
          )}

          {detail.brollMedia && detail.brollMedia.length > 0 && (
            <div className="card p-5">
              <p className="mb-2 text-[13px] text-muted">
                Görseller · {detail.brollMedia.filter((m) => m.kind === "image").length} görsel,{" "}
                {detail.brollMedia.filter((m) => m.kind === "video").length} video
              </p>
              <div className="flex flex-wrap gap-2">
                {detail.brollMedia.map((m) => (
                  <div key={m.ref} className="h-16 w-16 overflow-hidden rounded-lg bg-mist">
                    {m.kind === "image" ? (
                      <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <video src={m.url} muted className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
