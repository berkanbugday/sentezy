"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Avatar, BgImage, UserAvatar, Voice } from "@/components/WizardSteps";
import { apiFetch } from "@/lib/api";
import type { ApiVideo } from "@/lib/types";
import { toInitials } from "@/lib/user";

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
  brandKit: ["brand-kit"] as const,
  profile: ["profile"] as const,
};

/** The signed-in user's account. Email is the auth identity; plan/credits are server-owned. */
export type Profile = {
  displayName: string | null;
  email: string | null;
  plan: string;
  credits: number;
};

/** GET /profile provisions the row on first read, so this never 404s. Shared by the
 *  settings screen, the sidebar credit pill and the bottom-nav sheet. */
export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: () => apiFetch<Profile>("/profile") });
}

/** The name/initials/email to show in the account chrome. The profile's displayName is the
 *  single source of truth once it loads — the server layout only has the auth-derived name
 *  (email prefix or metadata), so without this the sidebar shows "Berkan / BE" while the
 *  settings screen shows the saved display name and initials. Falls back to the passed-in auth
 *  identity until the profile arrives, and updates instantly when the name is saved (the
 *  mutation seeds this same cache). */
export function useIdentity(fallback: { name: string; email: string; initials: string }) {
  const name = useProfile().data?.displayName?.trim() || fallback.name;
  return { name, email: fallback.email, initials: toInitials(name) };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName: string | null }) =>
      apiFetch<Profile>("/profile", { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (p) => qc.setQueryData(qk.profile, p),
  });
}

/** Permanently delete the account (R2 + DB + auth). Irreversible — the caller confirms and
 *  then signs the user out; there is no cache to update because there is no account left. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>("/profile", { method: "DELETE" }),
  });
}

/** The user's brand kit. `*Key` fields are what gets stored on a video; the `*Url` fields
 *  are freshly-signed previews and must never be persisted — they expire. */
export type BrandKit = {
  brandName: string | null;
  handle: string | null;
  logoKey: string | null;
  color: string;
  font: string;
  outroCta: string | null;
  introClipKey: string | null;
  introClipMs: number | null;
  /** {x, y, scale} framing for the upload — null until the user drags it. */
  introClipCrop: { x: number; y: number; scale: number } | null;
  outroClipKey: string | null;
  outroClipMs: number | null;
  outroClipCrop: { x: number; y: number; scale: number } | null;
  logoUrl: string | null;
  introClipUrl: string | null;
  outroClipUrl: string | null;
};

/** GET /brand-kit never 404s — a user with no saved kit gets the defaults. */
export function useBrandKit(enabled = true) {
  return useQuery({
    queryKey: qk.brandKit,
    queryFn: () => apiFetch<BrandKit>("/brand-kit"),
    enabled,
  });
}

export function useUpdateBrandKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<BrandKit, "logoUrl" | "introClipUrl" | "outroClipUrl">>) =>
      apiFetch<BrandKit>("/brand-kit", { method: "PUT", body: JSON.stringify(input) }),
    // The response is the saved kit with fresh signed URLs, so seed the cache with it
    // rather than invalidating — avoids a redundant refetch right after saving.
    onSuccess: (kit) => qc.setQueryData(qk.brandKit, kit),
  });
}

/** Upload a brand asset (logo image or intro/outro clip): presigned R2 PUT, then the key
 *  is saved separately through useUpdateBrandKit. */
export function useUploadBrandAsset() {
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "logo" | "clip" }): Promise<{ key: string; url: string }> => {
      const contentType = file.type || (kind === "logo" ? "image/png" : "video/mp4");
      const { key, uploadURL, url } = await apiFetch<{ key: string; uploadURL: string; url: string }>(
        `/brand-kit/${kind}`,
        { method: "POST", body: JSON.stringify({ contentType }) },
      );
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      return { key, url };
    },
  });
}

/** The background-music catalog, optionally narrowed to one mood (filtered server-side). */
export function useMusic(mood = "", enabled = true) {
  return useQuery({
    queryKey: qk.music(mood),
    queryFn: () => apiFetch<{ music: MusicTrack[]; moods: MusicMood[] }>(`/music${mood ? `?mood=${encodeURIComponent(mood)}` : ""}`),
    enabled,
    // Changing `mood` changes the query key, so without this the mood chip row (and the
    // track list) would collapse to empty/"All" for a beat on every click. Keeping the
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
