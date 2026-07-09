"use client";

import { useQuery } from "@tanstack/react-query";
import type { Avatar, Presenter, Voice } from "@/components/WizardSteps";
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
