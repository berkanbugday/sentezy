// Voice filters are ElevenLabs shared-voices enum values ("" = no filter), applied
// server-side so pagination + filtering compose correctly.
export const V_GENDER = [
  { v: "", label: "Gender: any" },
  { v: "female", label: "Female" },
  { v: "male", label: "Male" },
];
export const V_AGE = [
  { v: "", label: "Age: any" },
  { v: "young", label: "Young" },
  { v: "middle_aged", label: "Middle-aged" },
  { v: "old", label: "Older" },
];
export const V_CATEGORY = [
  { v: "", label: "Type: any" },
  { v: "professional", label: "Professional" },
  { v: "high_quality", label: "High quality" },
  { v: "famous", label: "Famous" },
];
export const V_USECASE = [
  { v: "", label: "Best for: any" },
  { v: "conversational", label: "Conversation" },
  { v: "narrative_story", label: "Storytelling" },
  { v: "social_media", label: "Social media" },
  { v: "entertainment_tv", label: "Entertainment / TV" },
  { v: "advertisement", label: "Ads" },
  { v: "informative_educational", label: "Explaining / teaching" },
  { v: "characters_animation", label: "Characters" },
];
export const V_LANG = [
  { v: "", label: "Language: any" },
  { v: "tr", label: "Turkish" },
  { v: "en", label: "English" },
  { v: "es", label: "Spanish" },
  { v: "de", label: "German" },
  { v: "fr", label: "French" },
  { v: "it", label: "Italian" },
  { v: "pt", label: "Portuguese" },
  { v: "pl", label: "Polish" },
  { v: "ru", label: "Russian" },
  { v: "nl", label: "Dutch" },
  { v: "ar", label: "Arabic" },
  { v: "hi", label: "Hindi" },
  { v: "ja", label: "Japanese" },
  { v: "ko", label: "Korean" },
  { v: "zh", label: "Chinese" },
];
export const V_ACCENT = [
  { v: "", label: "Accent: any" },
  { v: "american", label: "American" },
  { v: "british", label: "British" },
  { v: "australian", label: "Australian" },
  { v: "canadian", label: "Canadian" },
  { v: "irish", label: "Irish" },
  { v: "indian", label: "Indian" },
  { v: "african", label: "African" },
];
