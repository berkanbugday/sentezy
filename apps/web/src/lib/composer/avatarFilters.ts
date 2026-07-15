// Filter values match the DB/catalog Turkish values and the /avatars query params.
export type Gender = "all" | "kadın" | "erkek";
export type Age = "all" | "genç" | "yetişkin" | "olgun";
export const AGE_OPTS: { v: Age; label: string }[] = [
  { v: "all", label: "Yaş: Tümü" },
  { v: "genç", label: "Genç" },
  { v: "yetişkin", label: "Yetişkin" },
  { v: "olgun", label: "Olgun" },
];
export const GENDER_OPTS: { v: Gender; label: string }[] = [
  { v: "all", label: "Cinsiyet: Tümü" },
  { v: "kadın", label: "Kadın" },
  { v: "erkek", label: "Erkek" },
];

// Hijab (headscarf) filter — "true"/"false" match the /avatars query param values.
export type Hijab = "all" | "true" | "false";
export const HIJAB_OPTS: { v: Hijab; label: string }[] = [
  { v: "all", label: "Başörtüsü: Tümü" },
  { v: "true", label: "Başörtülü" },
  { v: "false", label: "Başörtüsüz" },
];
