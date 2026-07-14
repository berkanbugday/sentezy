export type Gender = "all" | "kadın" | "erkek";
export function normGender(g?: string | null): "kadın" | "erkek" | null {
  if (!g) return null;
  const s = g.toLowerCase();
  if (s.includes("fem") || s === "kadın") return "kadın"; // check "female" before "male"
  if (s.includes("male") || s === "erkek") return "erkek";
  return null;
}
export type Age = "all" | "genç" | "yetişkin" | "olgun";
export function normAge(a?: string | null): "genç" | "yetişkin" | "olgun" | null {
  if (!a) return null;
  const s = a.toLowerCase();
  if (s.includes("young") || s === "genç") return "genç";
  if (s.includes("middle") || s === "yetişkin") return "yetişkin";
  if (s.includes("old") || s.includes("mature") || s.includes("senior") || s === "olgun") return "olgun";
  return null;
}
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
