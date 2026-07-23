// Labels are English; the VALUES stay Turkish because they are the catalog values the
// /avatars endpoint filters on. Translating a value silently breaks the filter.
export type Gender = "all" | "kadın" | "erkek";
export type Age = "all" | "genç" | "yetişkin" | "olgun";
export const AGE_OPTS: { v: Age; label: string }[] = [
  { v: "all", label: "Age: any" },
  { v: "genç", label: "Young" },
  { v: "yetişkin", label: "Adult" },
  { v: "olgun", label: "Older" },
];
export const GENDER_OPTS: { v: Gender; label: string }[] = [
  { v: "all", label: "Gender: any" },
  { v: "kadın", label: "Women" },
  { v: "erkek", label: "Men" },
];

// Hijab (headscarf) filter — "true"/"false" match the /avatars query param values.
export type Hijab = "all" | "true" | "false";
export const HIJAB_OPTS: { v: Hijab; label: string }[] = [
  { v: "all", label: "Hijab: any" },
  { v: "true", label: "With hijab" },
  { v: "false", label: "Without hijab" },
];
