export type VideoStatus = "draft" | "queued" | "processing" | "ready" | "failed";
export type VideoStage = "tts" | "avatar" | "compose" | "thumbnail" | "done" | null;

export type ApiVideo = {
  id: string;
  title: string;
  status: VideoStatus;
  stage: VideoStage;
  progress: number;
  aspectRatio: "9:16" | "1:1" | "16:9";
  outputKey: string | null;
  thumbnailImageId: string | null;
  thumbnailUrl: string | null;
  durationS: number | null;
  createdAt: string;
};

export const STATUS_LABEL: Record<VideoStatus, [string, string]> = {
  draft: ["Taslak", "badge-draft"],
  queued: ["Sırada", "badge-proc"],
  processing: ["İşleniyor", "badge-proc"],
  ready: ["Hazır", "badge-ready"],
  failed: ["Başarısız", "badge-fail"],
};

/** The DB/API stores the aspect ratio as a Prisma enum member ("r9_16"); show it as "9:16". */
export function formatRatio(r: string): string {
  const map: Record<string, string> = { r9_16: "9:16", r1_1: "1:1", r16_9: "16:9" };
  return map[r] ?? r;
}

export const STAGE_LABEL: Record<string, string> = {
  tts: "Ses üretiliyor",
  avatar: "Avatar oluşturuluyor",
  compose: "Video kurgulanıyor",
  thumbnail: "Küçük resim hazırlanıyor",
  done: "Tamamlandı",
};
