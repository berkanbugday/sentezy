// Voice filters are ElevenLabs shared-voices enum values ("" = no filter), applied
// server-side so pagination + filtering compose correctly.
export const V_GENDER = [
  { v: "", label: "Cinsiyet: Tümü" },
  { v: "female", label: "Kadın" },
  { v: "male", label: "Erkek" },
];
export const V_AGE = [
  { v: "", label: "Yaş: Tümü" },
  { v: "young", label: "Genç" },
  { v: "middle_aged", label: "Yetişkin" },
  { v: "old", label: "Olgun" },
];
export const V_CATEGORY = [
  { v: "", label: "Tür: Tümü" },
  { v: "professional", label: "Profesyonel" },
  { v: "high_quality", label: "Yüksek kalite" },
  { v: "famous", label: "Ünlü" },
];
export const V_USECASE = [
  { v: "", label: "Kullanım: Tümü" },
  { v: "conversational", label: "Sohbet" },
  { v: "narrative_story", label: "Anlatı / Hikaye" },
  { v: "social_media", label: "Sosyal medya" },
  { v: "entertainment_tv", label: "Eğlence / TV" },
  { v: "advertisement", label: "Reklam" },
  { v: "informative_educational", label: "Bilgilendirici / Eğitim" },
  { v: "characters_animation", label: "Karakter / Animasyon" },
];
export const V_LANG = [
  { v: "", label: "Dil: Tümü" },
  { v: "tr", label: "Türkçe" },
  { v: "en", label: "İngilizce" },
  { v: "es", label: "İspanyolca" },
  { v: "de", label: "Almanca" },
  { v: "fr", label: "Fransızca" },
  { v: "it", label: "İtalyanca" },
  { v: "pt", label: "Portekizce" },
  { v: "pl", label: "Lehçe" },
  { v: "ru", label: "Rusça" },
  { v: "nl", label: "Felemenkçe" },
  { v: "ar", label: "Arapça" },
  { v: "hi", label: "Hintçe" },
  { v: "ja", label: "Japonca" },
  { v: "ko", label: "Korece" },
  { v: "zh", label: "Çince" },
];
export const V_ACCENT = [
  { v: "", label: "Aksan: Tümü" },
  { v: "american", label: "Amerikan" },
  { v: "british", label: "İngiliz" },
  { v: "australian", label: "Avustralya" },
  { v: "canadian", label: "Kanada" },
  { v: "irish", label: "İrlanda" },
  { v: "indian", label: "Hint" },
  { v: "african", label: "Afrika" },
];
