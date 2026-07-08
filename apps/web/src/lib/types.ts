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

export const STAGE_LABEL: Record<string, string> = {
  tts: "Ses üretiliyor",
  avatar: "Avatar oluşturuluyor",
  compose: "Video kurgulanıyor",
  thumbnail: "Küçük resim hazırlanıyor",
  done: "Tamamlandı",
};
