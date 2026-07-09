"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Avatar, BgImage, Presenter, Voice } from "@/components/WizardSteps";
import { apiFetch } from "@/lib/api";
import type { ApiVideo } from "@/lib/types";

export type VideoDetailData = {
  video: ApiVideo;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  brollImageUrls?: string[];
};

/** Query keys — one place so mutations can invalidate/update the right cache. */
export const qk = {
  voices: ["voices"] as const,
  avatars: ["avatars"] as const,
  presenters: ["presenters"] as const,
  videos: ["videos"] as const,
  video: (id: string) => ["video", id] as const,
};

export function useVoices(enabled = true) {
  return useQuery({ queryKey: qk.voices, queryFn: () => apiFetch<{ voices: Voice[] }>("/voices").then((r) => r.voices), enabled });
}

export function useAvatars(enabled = true) {
  return useQuery({ queryKey: qk.avatars, queryFn: () => apiFetch<{ avatars: Avatar[] }>("/avatars").then((r) => r.avatars), enabled });
}

export function usePresenters(enabled = true) {
  return useQuery({ queryKey: qk.presenters, queryFn: () => apiFetch<{ presenters: Presenter[] }>("/presenters").then((r) => r.presenters), enabled });
}

export function useVideos() {
  return useQuery({ queryKey: qk.videos, queryFn: () => apiFetch<{ videos: ApiVideo[] }>("/videos").then((r) => r.videos) });
}

export function useVideo(id: string) {
  return useQuery({ queryKey: qk.video(id), queryFn: () => apiFetch<VideoDetailData>(`/videos/${id}`) });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** Create a presenter from a preset avatar and add it to the presenters cache. */
export function useCreatePresenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sourceImageId: string }) =>
      apiFetch<{ presenter: Presenter; imageUrl: string }>("/presenters", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: ({ presenter, imageUrl }) =>
      qc.setQueryData<Presenter[]>(qk.presenters, (old) => [{ ...presenter, imageUrl }, ...(old ?? [])]),
  });
}

/** Upload one B-roll image: get a direct-upload URL, PUT the file, return {id,url}. */
export function useUploadBackground() {
  return useMutation({
    mutationFn: async (file: File): Promise<BgImage> => {
      const { id, uploadURL, imageUrl } = await apiFetch<{ id: string; uploadURL: string; imageUrl: string }>(
        "/backgrounds/upload",
        { method: "POST", body: JSON.stringify({}) },
      );
      const fd = new FormData();
      fd.append("file", file);
      await fetch(uploadURL, { method: "POST", body: fd });
      return { id, url: imageUrl };
    },
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
