import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { CreateReelValues } from "@/lib/schemas";

export type { MusicTrack } from "@/lib/queries";

export type Voice = {
  id: string;
  label: string;
  gender: string | null;
  style: string | null;
  age?: string | null;
  accent?: string | null;
  useCase?: string | null;
  descriptive?: string | null;
  category?: string | null;
  language?: string | null;
  locale?: string | null;
  description?: string | null;
  previewUrl?: string | null;
};

export type Presenter = { id: string; name: string; status: string; imageUrl?: string | null; sourceImageId?: string | null };

export type Common = {
  register: UseFormRegister<CreateReelValues>;
  errors: FieldErrors<CreateReelValues>;
  values: CreateReelValues;
  setValue: (name: keyof CreateReelValues, value: CreateReelValues[keyof CreateReelValues], opts?: object) => void;
};

export type BgImage = { id: string; url: string; transition?: string; kind?: "image" | "video" };

export type Avatar = {
  id: string; // Cloudflare Images id — "" while the portrait is still pending
  slug: string;
  name: string;
  imageUrl: string;
  sector: string;
  sectorLabel: string;
  gender: "kadın" | "erkek";
  age: "genç" | "yetişkin" | "olgun";
  ready: boolean;
};
