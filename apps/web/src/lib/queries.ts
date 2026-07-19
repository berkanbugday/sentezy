"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Avatar, BgImage, UserAvatar, Voice } from "@/components/WizardSteps";
import { apiFetch } from "@/lib/api";
import type { ApiVideo } from "@/lib/types";

export type BrollMediaItem = { kind: "image" | "video"; ref: string; transition?: string; url: string };
export type VideoDetailData = {
  video: ApiVideo;
  downloadUrl: string | null;
  fileDownloadUrl: string | null;
  thumbnailUrl: string | null;
  brollImageUrls?: string[];
  brollMedia?: BrollMediaItem[];
  avatar?: Avatar | null;
  voice?: Voice | null;
};

export type MusicTrack = {
  key: string; // R2 object key — what lands in options.music.trackKey
  slug: string;
  name: string;
  mood: string;
  moodLabel: string;
  durationSec: number;
  previewUrl: string;
};
export type MusicMood = { slug: string; label: string };

/** Query keys — one place so mutations can invalidate/update the right cache. */
export const qk = {
  voices: ["voices"] as const,
  avatars: ["avatars"] as const,
  myAvatars: ["my-avatars"] as const,
  music: (mood = "") => ["music", mood] as const,
  videos: ["videos"] as const,
  video: (id: string) => ["video", id] as const,
};

/** The background-music catalog, optionally narrowed to one mood (filtered server-side). */
export function useMusic(mood = "", enabled = true) {
  return useQuery({
    queryKey: qk.music(mood),
    queryFn: () => apiFetch<{ music: MusicTrack[]; moods: MusicMood[] }>(`/music${mood ? `?mood=${encodeURIComponent(mood)}` : ""}`),
    enabled,
    // Changing `mood` changes the query key, so without this the mood chip row (and the
    // track list) would collapse to empty/"Tümü" for a beat on every click. Keeping the
    // previous page's data visible until the new one lands is a one-line fix — smaller
    // than giving moods their own unfiltered query — and `moods` is identical across
    // mood filters anyway (only `music` actually varies).
    placeholderData: keepPreviousData,
  });
}

export function useVoices(enabled = true) {
  return useQuery({ queryKey: qk.voices, queryFn: () => apiFetch<{ voices: Voice[] }>("/voices").then((r) => r.voices), enabled });
}

/** Paginated + server-side-filtered shared-voice library browse (lazy "load more"). */
export function useVoicesInfinite(filters: Record<string, string> = {}) {
  const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const qs = new URLSearchParams(active).toString();
  return useInfiniteQuery({
    queryKey: [...qk.voices, "infinite", active],
    queryFn: ({ pageParam }) => apiFetch<{ voices: Voice[]; hasMore: boolean }>(`/voices?page=${pageParam}${qs ? `&${qs}` : ""}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
  });
}

/** Real TTS preview: synthesize a short clip of the user's own text with a voice.
 *  A shared-library voice id ("owner|voice") is adopted into the account server-side. */
export function useVoicePreview() {
  return useMutation({
    mutationFn: (input: { id: string; text: string; emotion?: string }) =>
      apiFetch<{ audio: string; mime: string }>("/voices/preview", { method: "POST", body: JSON.stringify(input) }),
  });
}

/** Avatar catalog browse — filters (sector/gender/age/hijab) are applied in the DB. */
export function useAvatars(filters: Record<string, string> = {}, enabled = true) {
  const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== "all"));
  const qs = new URLSearchParams(active).toString();
  return useQuery({
    queryKey: [...qk.avatars, active],
    queryFn: () => apiFetch<{ avatars: Avatar[] }>(`/avatars${qs ? `?${qs}` : ""}`).then((r) => r.avatars),
    enabled,
  });
}

export function useMyAvatars(enabled = true) {
  return useQuery({ queryKey: qk.myAvatars, queryFn: () => apiFetch<{ avatars: UserAvatar[] }>("/avatars/mine").then((r) => r.avatars), enabled });
}

export function useVideos() {
  return useQuery({ queryKey: qk.videos, queryFn: () => apiFetch<{ videos: ApiVideo[] }>("/videos").then((r) => r.videos) });
}

export function useVideo(id: string) {
  return useQuery({ queryKey: qk.video(id), queryFn: () => apiFetch<VideoDetailData>(`/videos/${id}`), enabled: Boolean(id) });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** Create an avatar from a preset (or upload) and add it to the user's avatars cache. */
export function useCreateAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sourceImageId: string }) =>
      apiFetch<{ avatar: UserAvatar; imageUrl: string }>("/avatars", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: ({ avatar, imageUrl }) =>
      qc.setQueryData<UserAvatar[]>(qk.myAvatars, (old) => [{ ...avatar, imageUrl }, ...(old ?? [])]),
  });
}

/** Upload one B-roll image: presigned R2 PUT (key), then return {id: key, url: signed}. */
export function useUploadBackground() {
  return useMutation({
    mutationFn: async (file: File): Promise<BgImage> => {
      const contentType = file.type || "image/png";
      const { id, uploadURL, imageUrl } = await apiFetch<{ id: string; uploadURL: string; imageUrl: string }>(
        "/backgrounds/upload",
        { method: "POST", body: JSON.stringify({ contentType }) },
      );
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      return { id, url: imageUrl };
    },
  });
}

/** Upload one B-roll video clip: get a presigned R2 PUT, upload it, return {key,url}. */
export function useUploadBackgroundVideo() {
  return useMutation({
    mutationFn: async (file: File): Promise<{ key: string; url: string }> => {
      const contentType = file.type || "video/mp4";
      const { key, uploadURL, previewUrl } = await apiFetch<{ key: string; uploadURL: string; previewUrl: string }>(
        "/backgrounds/upload-video",
        { method: "POST", body: JSON.stringify({ contentType }) },
      );
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      return { key, url: previewUrl };
    },
  });
}

/** Scenario-step "add emotion": vision pass that annotates the script with v3 audio tags. */
export function useEnhanceEmotion() {
  return useMutation({
    mutationFn: (input: { script: string; imageIds: string[]; tone: string }) =>
      apiFetch<{ script: string; changed: boolean; enabled: boolean }>("/videos/enhance-emotion", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export type ImportedMedia = { ref: string; url: string; kind: "image" | "video" };
export type ImportProductResult = {
  product: { sourceUrl: string; title: string; price?: string; description?: string };
  media: ImportedMedia[];
  script: string;
};

/** Paste-a-product-link: scrape the page → media in R2 + an AI promo script. */
export function useImportProduct() {
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ImportProductResult>("/import-product", { method: "POST", body: JSON.stringify({ url }) }),
  });
}

/** Finalize a draft → queue it for the worker. */
export function useGenerateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ video: { id: string } }>(`/videos/${id}/generate`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.videos }),
  });
}

/** Rename a video at any status (the draft-only PATCH /videos/:id cannot do this). */
export function useRenameVideo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      apiFetch<{ video: ApiVideo }>(`/videos/${id}/title`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: (data) => {
      qc.setQueryData<VideoDetailData>(qk.video(id), (prev) =>
        prev ? { ...prev, video: { ...prev.video, title: data.video.title, options: data.video.options } } : prev,
      );
      qc.invalidateQueries({ queryKey: qk.video(id) });
      qc.invalidateQueries({ queryKey: qk.videos });
    },
  });
}

/** Soft delete — the row is hidden everywhere; the caller navigates away on success. */
export function useDeleteVideo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/videos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.videos });
      qc.removeQueries({ queryKey: qk.video(id) });
    },
  });
}
