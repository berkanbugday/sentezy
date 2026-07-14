"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { useAvatars, useUploadBackground, useUploadBackgroundVideo, useVoicePreview, useVoicesInfinite } from "@/lib/queries";
import { CAPTION_COLORS, CAPTION_FAMILIES, CAPTION_FONTS, CAPTION_PRESETS, DEFAULT_PRESET, presetById, type CaptionPreset } from "@/lib/captionStyles";
import { CaptionAnimated } from "./CaptionSample";
import { Icon } from "./icons";

type Gender = "all" | "kadın" | "erkek";
function normGender(g?: string | null): "kadın" | "erkek" | null {
  if (!g) return null;
  const s = g.toLowerCase();
  if (s.includes("fem") || s === "kadın") return "kadın"; // check "female" before "male"
  if (s.includes("male") || s === "erkek") return "erkek";
  return null;
}
type Age = "all" | "genç" | "yetişkin" | "olgun";
function normAge(a?: string | null): "genç" | "yetişkin" | "olgun" | null {
  if (!a) return null;
  const s = a.toLowerCase();
  if (s.includes("young") || s === "genç") return "genç";
  if (s.includes("middle") || s === "yetişkin") return "yetişkin";
  if (s.includes("old") || s.includes("mature") || s.includes("senior") || s === "olgun") return "olgun";
  return null;
}
const AGE_OPTS: { v: Age; label: string }[] = [
  { v: "all", label: "Yaş: Tümü" },
  { v: "genç", label: "Genç" },
  { v: "yetişkin", label: "Yetişkin" },
  { v: "olgun", label: "Olgun" },
];
const GENDER_OPTS: { v: Gender; label: string }[] = [
  { v: "all", label: "Cinsiyet: Tümü" },
  { v: "kadın", label: "Kadın" },
  { v: "erkek", label: "Erkek" },
];

// Voice filters are ElevenLabs shared-voices enum values ("" = no filter), applied
// server-side so pagination + filtering compose correctly.
const V_GENDER = [
  { v: "", label: "Cinsiyet: Tümü" },
  { v: "female", label: "Kadın" },
  { v: "male", label: "Erkek" },
];
const V_AGE = [
  { v: "", label: "Yaş: Tümü" },
  { v: "young", label: "Genç" },
  { v: "middle_aged", label: "Yetişkin" },
  { v: "old", label: "Olgun" },
];
const V_CATEGORY = [
  { v: "", label: "Tür: Tümü" },
  { v: "professional", label: "Profesyonel" },
  { v: "high_quality", label: "Yüksek kalite" },
  { v: "famous", label: "Ünlü" },
];
const V_USECASE = [
  { v: "", label: "Kullanım: Tümü" },
  { v: "conversational", label: "Sohbet" },
  { v: "narrative_story", label: "Anlatı / Hikaye" },
  { v: "social_media", label: "Sosyal medya" },
  { v: "entertainment_tv", label: "Eğlence / TV" },
  { v: "advertisement", label: "Reklam" },
  { v: "informative_educational", label: "Bilgilendirici / Eğitim" },
  { v: "characters_animation", label: "Karakter / Animasyon" },
];
const V_LANG = [
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
const V_ACCENT = [
  { v: "", label: "Aksan: Tümü" },
  { v: "american", label: "Amerikan" },
  { v: "british", label: "İngiliz" },
  { v: "australian", label: "Avustralya" },
  { v: "canadian", label: "Kanada" },
  { v: "irish", label: "İrlanda" },
  { v: "indian", label: "Hint" },
  { v: "african", label: "Afrika" },
];
import { EffectPreview } from "./TransitionPreview";
import { DEFAULT_TRANSITION, TRANSITIONS } from "./WizardSteps";

type Status = "uploading" | "done" | "error";
type Media = { url: string; name: string; kind: "image" | "video"; file: File; status: Status; ref?: string; serverUrl?: string; poster?: string; transition?: string };

const PENDING_KEY = "sentezy:pending-create";

// value → human label (e.g. "whip" → "Savurma") for the between-clip transition buttons.
const TRANSITION_LABELS: Record<string, string> = Object.fromEntries(
  TRANSITIONS.flatMap((g) => g.items).map((it) => [it.value, it.label]),
);

// Connector line between clips — echoes the sidebar's --frame palette (blue→purple→warm).
const TR_GRADIENT = "linear-gradient(90deg, rgb(52,104,184), rgb(96,64,168), rgb(170,86,96))";
// Soft tint of the same palette for the transition node button.
const TR_GRADIENT_SOFT = "linear-gradient(135deg, rgba(52,104,184,0.16), rgba(96,64,168,0.16), rgba(170,86,96,0.16))";

/** Draw a frame from a video file to a canvas and return a JPEG object URL — a
 *  reliable cross-browser thumbnail (a bare <video> often paints a blank tile). */
function videoPoster(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(file);
    const done = (out: string | null) => {
      URL.revokeObjectURL(video.src);
      resolve(out);
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob ? URL.createObjectURL(blob) : null), "image/jpeg", 0.8);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
  });
}

/** Small on-brand dropdown menu (replaces native <select> so the caret has room). */
function Dropdown({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = options.find((o) => o.v === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1.5 pl-3.5 pr-3 text-[12px] font-medium text-slate transition hover:bg-mist">
        {current?.label ?? ""}
        <Icon.chevronDown width={13} height={13} className="text-muted" />
      </button>
      {open && (
        <div className="no-scrollbar absolute left-0 top-full z-30 mt-1 max-h-56 min-w-[140px] overflow-y-auto rounded-xl border border-hairline bg-paper py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => {
                onChange(o.v);
                setOpen(false);
              }}
              className={`block w-full whitespace-nowrap px-3 py-1.5 text-left text-[12.5px] transition hover:bg-mist ${o.v === value ? "font-semibold text-ink" : "text-slate"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline p-2">
      <span className="h-9 w-9 flex-none animate-pulse rounded-full bg-mist" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/3 animate-pulse rounded bg-mist" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-mist" />
      </div>
    </div>
  );
}

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// A caption-preset tile: static styled sample that sweeps word-by-word on hover/focus
// (or while selected), mirroring how the caption plays in the reel.
function CaptionTile({ preset, words, selected, onSelect }: { preset: CaptionPreset; words: string[]; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="text-left"
    >
      <div className={`relative grid aspect-video place-items-center overflow-hidden rounded-lg border bg-black px-2 transition ${selected ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
        <CaptionAnimated base={preset.base} font={preset.font} color={preset.color} words={words} play={hover || selected} />
        {selected && (
          <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          </span>
        )}
      </div>
      <div className={`mt-1.5 truncate px-0.5 text-[11px] font-medium ${selected ? "text-ink" : "text-slate"}`}>{preset.family} · {preset.font}</div>
    </button>
  );
}

// A transition-effect tile: static preview that plays only on hover/focus (or while
// selected), mirroring CaptionTile so the effect grid isn't a wall of motion.
function EffectTile({ value, label, selected, onSelect }: { value: string; label: string; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="text-left"
    >
      <div className={`relative aspect-video overflow-hidden rounded-lg border transition ${selected ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
        <EffectPreview value={value} play={hover || selected} />
        {selected && (
          <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          </span>
        )}
      </div>
      <div className={`mt-1.5 truncate px-0.5 text-[11px] font-medium ${selected ? "text-ink" : "text-slate"}`}>{label}</div>
    </button>
  );
}

/** Upload-first hero composer: accepts multiple images + videos, uploads each to
 *  storage (with per-tile progress), and carries the uploaded refs into /create. */
export function MediaComposer() {
  const router = useRouter();
  const uploadImg = useUploadBackground();
  const uploadVid = useUploadBackgroundVideo();
  const [items, setItems] = useState<Media[]>([]);
  const [drag, setDrag] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState<string | null>(null); // media url whose incoming transition is being edited
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [captionId, setCaptionId] = useState(DEFAULT_PRESET.id);
  const [captionQ, setCaptionQ] = useState("");
  const [captionFamily, setCaptionFamily] = useState(""); // "" = all
  const [captionFontF, setCaptionFontF] = useState("");
  const [captionColorF, setCaptionColorF] = useState("");
  const [captionFiltersOpen, setCaptionFiltersOpen] = useState(false);
  const [captionShown, setCaptionShown] = useState(60); // incremental reveal count
  const [captionRealText, setCaptionRealText] = useState(false); // preview tiles with the user's own script
  const [script, setScript] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceListRef = useRef<HTMLDivElement>(null);
  const voiceSentinelRef = useRef<HTMLDivElement>(null);
  const captionSentinelRef = useRef<HTMLDivElement>(null);
  const selectedCaption = presetById(captionId);

  const avatarsQ = useAvatars();
  const avatars = (avatarsQ.data ?? []).filter((a) => a.ready && a.id);
  const selectedAvatar = avatars.find((a) => a.id === avatarId) ?? null;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // avatar filters — client-side over the avatar list
  const [avatarQ, setAvatarQ] = useState("");
  const [avatarGender, setAvatarGender] = useState<Gender>("all");
  const [avatarAge, setAvatarAge] = useState<Age>("all");
  // voice filters — ElevenLabs enum values, applied server-side (so paging works)
  const [voiceQ, setVoiceQ] = useState("");
  const [voiceGender, setVoiceGender] = useState("");
  const [voiceAge, setVoiceAge] = useState("");
  const [voiceCategory, setVoiceCategory] = useState("");
  const [voiceLang, setVoiceLang] = useState("");
  const [voiceUseCase, setVoiceUseCase] = useState("");
  const [voiceAccent, setVoiceAccent] = useState("");
  const [realTts, setRealTts] = useState(false); // preview with the user's own text
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);

  const voicesQ = useVoicesInfinite({ gender: voiceGender, age: voiceAge, category: voiceCategory, language: voiceLang, use_cases: voiceUseCase, accent: voiceAccent });
  const voices = voicesQ.data?.pages.flatMap((p) => p.voices) ?? [];
  const selectedVoice = voices.find((v) => v.id === voiceId) ?? null;
  const voicePreview = useVoicePreview();

  const voiceFilterGroups = [
    { title: "Cinsiyet", value: voiceGender, set: setVoiceGender, options: V_GENDER },
    { title: "Yaş", value: voiceAge, set: setVoiceAge, options: V_AGE },
    { title: "Dil", value: voiceLang, set: setVoiceLang, options: V_LANG },
    { title: "Aksan", value: voiceAccent, set: setVoiceAccent, options: V_ACCENT },
    { title: "Kullanım", value: voiceUseCase, set: setVoiceUseCase, options: V_USECASE },
    { title: "Tür", value: voiceCategory, set: setVoiceCategory, options: V_CATEGORY },
  ];
  const activeVoiceFilters = voiceFilterGroups.filter((g) => g.value !== "").length;
  function clearVoiceFilters() {
    setVoiceGender("");
    setVoiceAge("");
    setVoiceLang("");
    setVoiceAccent("");
    setVoiceUseCase("");
    setVoiceCategory("");
  }

  // Caption presets — filter the local catalog; reveal incrementally on scroll.
  const CAPTION_SAMPLE = ["Bunu", "MUTLAKA", "görmelisin"];
  // Tiles preview either a fixed sample or the first few words of the real script.
  const captionWords =
    captionRealText && script.trim() ? script.trim().split(/\s+/).slice(0, 4) : CAPTION_SAMPLE;
  const filteredCaptions = CAPTION_PRESETS.filter(
    (p) =>
      (!captionFamily || p.family === captionFamily) &&
      (!captionFontF || p.font === captionFontF) &&
      (!captionColorF || p.color === captionColorF) &&
      (!captionQ.trim() || p.name.toLocaleLowerCase("tr").includes(captionQ.trim().toLocaleLowerCase("tr"))),
  );
  const activeCaptionFilters = [captionFamily, captionFontF, captionColorF].filter(Boolean).length;
  useEffect(() => { setCaptionShown(60); }, [captionQ, captionFamily, captionFontF, captionColorF]);
  useEffect(() => {
    if (!captionOpen) return;
    const el = captionSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) setCaptionShown((n) => n + 60); });
    io.observe(el);
    return () => io.disconnect();
  }, [captionOpen, filteredCaptions.length]);

  const filteredAvatars = avatars.filter(
    (a) =>
      (avatarGender === "all" || normGender(a.gender) === avatarGender) &&
      (avatarAge === "all" || normAge(a.age) === avatarAge) &&
      (!avatarQ.trim() || `${a.name} ${a.sectorLabel ?? ""}`.toLowerCase().includes(avatarQ.trim().toLowerCase())),
  );
  // voices are already filtered server-side by the dropdowns — only refine by text search
  const filteredVoices = voices.filter(
    (v) => !voiceQ.trim() || `${v.label} ${v.style ?? ""} ${v.accent ?? ""} ${v.descriptive ?? ""}`.toLowerCase().includes(voiceQ.trim().toLowerCase()),
  );

  function stopVoicePreview() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingVoice(null);
  }
  async function playVoice(id: string, previewUrl?: string | null) {
    if (playingVoice === id) return stopVoicePreview();
    audioRef.current?.pause();
    setTtsError(null);
    let url: string | null = null;
    const text = script.trim();
    if (realTts && text) {
      // synthesize the user's own text with this voice (opt-in real TTS)
      setTtsLoading(id);
      try {
        const { audio, mime } = await voicePreview.mutateAsync({ id, text });
        url = `data:${mime};base64,${audio}`;
      } catch (e) {
        setTtsLoading(null);
        setTtsError(e instanceof Error && e.message ? e.message : "Ses üretilemedi — API'yi yeniden başlat ve ElevenLabs anahtarını kontrol et.");
        return;
      }
      setTtsLoading(null);
    } else {
      url = previewUrl ?? null;
    }
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setPlayingVoice(null);
    a.play().catch(() => setTtsError("Tarayıcı otomatik oynatmayı engelledi — tekrar dokun."));
    setPlayingVoice(id);
  }
  useEffect(() => {
    if (!voiceOpen) stopVoicePreview();
  }, [voiceOpen]);
  useEffect(() => () => stopVoicePreview(), []);

  // infinite scroll: load the next page when the sentinel nears the bottom
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = voicesQ;
  useEffect(() => {
    if (!voiceOpen) return;
    const sentinel = voiceSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { root: voiceListRef.current, rootMargin: "160px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [voiceOpen, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The transition effect only applies between 2+ media — close/hide otherwise.
  const multiple = items.length > 1;
  useEffect(() => {
    if (!multiple) setEffectOpen(false);
  }, [multiple]);
  // The boundary currently being edited (its incoming transition), for the effect modal.
  const activeTransition = items.find((x) => x.url === activeBoundary)?.transition ?? DEFAULT_TRANSITION;

  // Revoke object URLs on unmount (ref keeps the latest list for the cleanup).
  const itemsRef = useRef<Media[]>([]);
  itemsRef.current = items;
  useEffect(
    () => () =>
      itemsRef.current.forEach((m) => {
        URL.revokeObjectURL(m.url);
        if (m.poster) URL.revokeObjectURL(m.poster);
      }),
    [],
  );

  const patch = (url: string, next: Partial<Media>) => setItems((prev) => prev.map((x) => (x.url === url ? { ...x, ...next } : x)));

  async function uploadOne(m: Media) {
    try {
      if (m.kind === "image") {
        const { id, url } = await uploadImg.mutateAsync(m.file);
        patch(m.url, { status: "done", ref: id, serverUrl: url });
      } else {
        const { key, url } = await uploadVid.mutateAsync(m.file);
        patch(m.url, { status: "done", ref: key, serverUrl: url });
      }
    } catch {
      patch(m.url, { status: "error" });
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Media[] = [];
    for (const f of Array.from(files)) {
      const kind = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : null;
      if (kind) next.push({ url: URL.createObjectURL(f), name: f.name, kind, file: f, status: "uploading", transition: "whip" });
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
      next.forEach((m) => {
        void uploadOne(m);
        if (m.kind === "video") videoPoster(m.file).then((p) => p && patch(m.url, { poster: p }));
      });
    }
    if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
  }

  function remove(url: string) {
    const m = itemsRef.current.find((x) => x.url === url);
    URL.revokeObjectURL(url);
    if (m?.poster) URL.revokeObjectURL(m.poster);
    setItems((prev) => prev.filter((x) => x.url !== url));
  }

  function retry(m: Media) {
    patch(m.url, { status: "uploading" });
    void uploadOne({ ...m, status: "uploading" });
  }

  const uploading = items.some((i) => i.status === "uploading");
  const hasScript = script.trim().length > 0; // controls stay visible but disabled until written
  const pick = () => inputRef.current?.click();

  function create() {
    const ready = items.filter((i) => i.status === "done" && i.ref);
    const preset = presetById(captionId);
    const payload = {
      // Each clip carries its own incoming transition; the first clip's is unused.
      media: ready.map((i, idx) => ({ ref: i.ref, url: i.serverUrl, kind: i.kind, transition: idx === 0 ? DEFAULT_TRANSITION : i.transition ?? DEFAULT_TRANSITION })),
      script: script.trim() || undefined,
      avatar: selectedAvatar ? { id: selectedAvatar.id, name: selectedAvatar.name } : undefined,
      voice: selectedVoice ? { id: selectedVoice.id } : undefined,
      caption: { style: preset.base, font: preset.font, color: preset.color },
    };
    try {
      if (payload.media.length || payload.script || payload.avatar) sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch { }
    router.push("/create");
  }

  return (
    <div
      className={`mt-7 rounded-[22px] border bg-paper p-3.5 shadow-sm transition ${drag ? "border-ink ring-2 ring-ink/10" : "border-hairline"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {items.length === 0 ? (
        <button
          type="button"
          onClick={pick}
          className={`flex w-full flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed px-6 py-16 text-center transition ${drag ? "border-ink bg-mist" : "border-hairline hover:bg-mist/60"
            }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-slate">
            <Icon.plus width={24} height={24} />
          </span>
          <div>
            <p className="text-[14.5px] font-medium text-ink">Videolarını ya da görsellerini sürükle</p>
            <p className="mt-0.5 text-[12.5px] text-muted">(.mp4, .mov, .jpg, .png — birden fazla seçebilirsin)</p>
          </div>
        </button>
      ) : (
        <div className="no-scrollbar flex flex-nowrap items-center overflow-x-auto pb-1">
          {items.map((m, i) => (
            <Fragment key={m.url}>
              {/* transition connector between two clips — a gradient line with this gap's effect node */}
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => { setActiveBoundary(m.url); setEffectOpen(true); }}
                  title={`Geçiş: ${TRANSITION_LABELS[m.transition ?? DEFAULT_TRANSITION] ?? ""}`}
                  aria-label="Geçiş efekti seç"
                  className="group/tr flex flex-none flex-col items-center gap-1 px-0.5"
                >
                  <span className="flex items-center">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: TR_GRADIENT }} />
                    <span className="mx-0.5 grid h-7 w-7 place-items-center rounded-full border border-hairline text-slate transition group-hover/tr:text-ink" style={{ background: TR_GRADIENT_SOFT }}>
                      <Icon.wand width={13} height={13} />
                    </span>
                    <span className="h-0.5 w-3 rounded-full" style={{ background: TR_GRADIENT }} />
                  </span>
                  <span className="max-w-[60px] truncate text-[9px] font-medium leading-none text-muted group-hover/tr:text-slate">
                    {TRANSITION_LABELS[m.transition ?? DEFAULT_TRANSITION] ?? ""}
                  </span>
                </button>
              )}
              <div className="group relative h-[68px] w-[68px] flex-none overflow-hidden rounded-xl border border-hairline bg-mist">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <>
                  {m.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.poster} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-mist text-muted">
                      <Icon.video width={22} height={22} />
                    </div>
                  )}
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    <Icon.video width={10} height={10} />
                    video
                  </span>
                </>
              )}

              {/* upload state overlays */}
              {m.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                  <Spinner />
                </div>
              )}
              {m.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white">
                  <span className="text-[9.5px] font-medium">Yüklenemedi</span>
                  <button type="button" onClick={() => retry(m)} className="rounded-full bg-white/20 px-2 py-0.5 text-[9.5px] font-semibold hover:bg-white/30">
                    Tekrar
                  </button>
                </div>
              )}
              {m.status === "done" && (
                <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper shadow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(m.url)}
                aria-label={`${m.name} kaldır`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Icon.close width={12} height={12} className="block" />
              </button>
              </div>
            </Fragment>
          ))}
          <button
            type="button"
            onClick={pick}
            className="ml-2 flex h-[68px] w-[68px] flex-none flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline text-muted transition hover:bg-mist hover:text-slate"
          >
            <Icon.plus width={20} height={20} />
            <span className="text-[10px] font-medium">Ekle</span>
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="video/*,image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      {/* speech / script text — softly appears once media is uploaded */}
      {items.length > 0 && (
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={3}
          placeholder="Videoda ne anlatılsın? Konuşma metnini yaz…"
          className="no-scrollbar soft-in mt-3 max-h-40 min-h-[84px] w-full resize-none overflow-y-auto rounded-xl bg-transparent px-1 py-1 text-[14px] leading-relaxed text-ink outline-none placeholder:text-muted"
        />
      )}

      {/* controls always visible, disabled until there's speech text to work with */}
      <div className="mt-3 flex flex-col gap-2.5 px-1 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* avatar mini-preview chip */}
          <button
            type="button"
            onClick={() => setAvatarOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded-full bg-mist text-muted">
              {selectedAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedAvatar.imageUrl} alt={selectedAvatar.name} className="h-full w-full object-cover" />
              ) : (
                <Icon.users width={15} height={15} />
              )}
            </span>
            {selectedAvatar ? selectedAvatar.name : "Avatar seç"}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
          {/* voice mini chip */}
          <button
            type="button"
            onClick={() => setVoiceOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-mist text-slate">
              <Icon.voice width={15} height={15} />
            </span>
            {selectedVoice ? selectedVoice.label : "Ses seç"}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
          {/* caption style chip */}
          <button
            type="button"
            onClick={() => setCaptionOpen(true)}
            disabled={!hasScript}
            title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="grid h-7 w-11 flex-none place-items-center overflow-hidden rounded-full bg-black">
              <span style={{ color: selectedCaption.color, fontFamily: `"${selectedCaption.font}", sans-serif`, fontWeight: 800, fontSize: 12, lineHeight: 1 }}>Aa</span>
            </span>
            {selectedCaption.family}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
          {items.length > 0 && (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted">
              {uploading && <Spinner size={13} />}
              {uploading ? "yükleniyor…" : `${items.length} medya hazır`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={uploading || !hasScript}
          title={!hasScript ? "Önce konuşma metnini yaz" : undefined}
          className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:w-auto"
        >
          {uploading ? <Spinner size={16} /> : <Icon.arrowRight width={17} height={17} className="order-2" />}
          <span className="order-1">Video oluştur</span>
        </button>
      </div>

      {/* slide/transition effect picker — only meaningful with 2+ media */}
      {effectOpen && multiple && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setEffectOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Geçiş Efekti</h3>
                  {activeBoundary && (
                    <p className="mt-0.5 text-[12px] text-muted">
                      {items.findIndex((x) => x.url === activeBoundary)}. ve {items.findIndex((x) => x.url === activeBoundary) + 1}. klip arası
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setEffectOpen(false)} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
            </div>

            <div className="no-scrollbar overflow-y-auto px-5 py-4">
              {TRANSITIONS.map((g) => (
                <div key={g.group} className="mb-6 last:mb-0">
                  <div className="mb-3 text-[14px] font-semibold text-ink">{g.group}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
                    {g.items.map((it) => (
                      <EffectTile key={it.value} value={it.value} label={it.label} selected={activeTransition === it.value} onSelect={() => { if (activeBoundary) patch(activeBoundary, { transition: it.value }); }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-none justify-end px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              <button type="button" onClick={() => setEffectOpen(false)} className="btn btn-primary min-w-28">
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* avatar picker */}
      {avatarOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setAvatarOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-start justify-between gap-3">
                <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Avatar seç</h3>
                <button type="button" onClick={() => setAvatarOpen(false)} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
              <div className="mb-3 mt-2 flex flex-col gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <Icon.search width={15} height={15} />
                  </span>
                  <input value={avatarQ} onChange={(e) => setAvatarQ(e.target.value)} placeholder="Avatar ara…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Dropdown value={avatarGender} onChange={(v) => setAvatarGender(v as Gender)} options={GENDER_OPTS} />
                  <Dropdown value={avatarAge} onChange={(v) => setAvatarAge(v as Age)} options={AGE_OPTS} />
                </div>
              </div>
            </div>

            <div className="no-scrollbar overflow-y-auto px-5 py-4">
              {avatarsQ.isLoading ? (
                <div className="py-10 text-center text-[14px] text-muted">Yükleniyor…</div>
              ) : filteredAvatars.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-muted">Avatar bulunamadı</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {filteredAvatars.map((a) => {
                    const sel = avatarId === a.id;
                    return (
                      <button key={a.id} type="button" onClick={() => setAvatarId(sel ? null : a.id)} className="text-left">
                        <div className={`relative aspect-[3/4] overflow-hidden rounded-xl border bg-mist transition ${sel ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                          {sel && (
                            <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12 5 5L20 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className={`mt-1.5 truncate px-0.5 text-[12px] font-medium ${sel ? "text-ink" : "text-slate"}`}>{a.name}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-none justify-end px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              <button type="button" onClick={() => setAvatarOpen(false)} className="btn btn-primary min-w-28">
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* voice picker */}
      {voiceOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setVoiceOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-start justify-between gap-3">
                <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Ses seç</h3>
                <button type="button" onClick={() => setVoiceOpen(false)} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
              <div className="mb-3 mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <Icon.search width={15} height={15} />
                  </span>
                  <input value={voiceQ} onChange={(e) => setVoiceQ(e.target.value)} placeholder="Ses ara…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="flex flex-none items-center gap-1.5 rounded-full border border-hairline bg-paper px-3.5 py-2 text-[13px] font-medium text-slate transition hover:bg-mist"
                >
                  <Icon.filter width={16} height={16} />
                  Filtrele
                  {activeVoiceFilters > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{activeVoiceFilters}</span>
                  )}
                </button>
              </div>
            </div>

            <div ref={voiceListRef} className="no-scrollbar flex flex-col gap-1.5 overflow-y-auto px-5 py-4">
              {voicesQ.isLoading ? (
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <VoiceSkeleton key={i} />
                  ))}
                </div>
              ) : filteredVoices.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-muted">Ses bulunamadı</div>
              ) : (
                filteredVoices.map((v) => {
                  const sel = voiceId === v.id;
                  const meta = [v.gender, v.style, v.age].filter(Boolean).join(" · ");
                  return (
                    <div key={v.id} className={`flex items-center gap-2 rounded-xl border p-2 transition ${sel ? "border-ink ring-1 ring-ink" : "border-hairline"}`}>
                      <button type="button" onClick={() => setVoiceId(sel ? null : v.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${sel ? "bg-ink text-paper" : "bg-mist text-slate"}`}>
                          <Icon.voice width={16} height={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold text-ink">{v.label}</div>
                          {meta && <div className="truncate text-[11.5px] text-muted">{meta}</div>}
                        </div>
                      </button>
                      {(v.previewUrl || realTts) && (
                        <button
                          type="button"
                          onClick={() => playVoice(v.id, v.previewUrl)}
                          disabled={ttsLoading === v.id}
                          aria-label="Önizle"
                          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border transition disabled:opacity-50 sm:h-9 sm:w-9 ${playingVoice === v.id ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist hover:text-ink"}`}
                        >
                          {ttsLoading === v.id ? <Spinner size={16} /> : playingVoice === v.id ? <Icon.pause width={17} height={17} /> : <Icon.play width={17} height={17} />}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              {voicesQ.isFetchingNextPage && Array.from({ length: 3 }).map((_, i) => <VoiceSkeleton key={`sk-${i}`} />)}
              <div ref={voiceSentinelRef} className="h-1 w-full" />
            </div>

            {ttsError && <div className="flex-none px-5 pb-1 text-[12px] text-[#dc2626]">{ttsError}</div>}

            <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              {hasScript ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={realTts}
                  onClick={() => {
                    setRealTts((r) => !r);
                    stopVoicePreview();
                  }}
                  className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
                >
                  <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${realTts ? "bg-ink" : "bg-hairline"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${realTts ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                  Yazdığım metni oku
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => setVoiceOpen(false)} className="btn btn-primary min-w-28">
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* voice filters */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="disp text-[18px] font-semibold text-ink">Filtreler</h3>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
            </div>
            <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 py-4">
              {voiceFilterGroups.map((g) => (
                <div key={g.title}>
                  <div className="mb-2 text-[13px] font-semibold text-ink">{g.title}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => (
                      <button key={o.v} type="button" onClick={() => g.set(o.v)} className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${g.value === o.v ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>
                        {o.v === "" ? "Tümü" : o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              <button type="button" onClick={clearVoiceFilters} className="rounded-full border border-hairline px-4 py-2 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink">
                Temizle
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="btn btn-primary min-w-28">
                Uygula ({filteredVoices.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* caption style picker */}
      {captionOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" aria-label="Kapat" onClick={() => setCaptionOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
            <div className="flex-none px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
              <div className="mb-1 flex items-start justify-between gap-3">
                <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Altyazı stili</h3>
                <button type="button" onClick={() => setCaptionOpen(false)} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
              <div className="mb-3 mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <Icon.search width={15} height={15} />
                  </span>
                  <input value={captionQ} onChange={(e) => setCaptionQ(e.target.value)} placeholder="Stil ara…" className="w-full rounded-full border border-hairline bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition focus:border-signal" />
                </div>
                <button type="button" onClick={() => setCaptionFiltersOpen(true)} className="flex flex-none items-center gap-1.5 rounded-full border border-hairline bg-paper px-3.5 py-2 text-[13px] font-medium text-slate transition hover:bg-mist">
                  <Icon.filter width={16} height={16} />
                  Filtrele
                  {activeCaptionFilters > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{activeCaptionFilters}</span>}
                </button>
              </div>
            </div>

            <div className="no-scrollbar overflow-y-auto px-5 py-4">
              {filteredCaptions.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-muted">Stil bulunamadı</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredCaptions.slice(0, captionShown).map((p) => (
                      <CaptionTile key={p.id} preset={p} words={captionWords} selected={captionId === p.id} onSelect={() => setCaptionId(p.id)} />
                    ))}
                  </div>
                  {captionShown < filteredCaptions.length && <div ref={captionSentinelRef} className="h-8" />}
                </>
              )}
            </div>

            <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
              {hasScript ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={captionRealText}
                  onClick={() => setCaptionRealText((r) => !r)}
                  className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
                >
                  <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${captionRealText ? "bg-ink" : "bg-hairline"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${captionRealText ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                  Yazdığım metni göster
                </button>
              ) : (
                <span className="text-[12px] text-muted">{filteredCaptions.length} stil</span>
              )}
              <button type="button" onClick={() => setCaptionOpen(false)} className="btn btn-primary min-w-28">Tamam</button>
            </div>
          </div>

          {/* nested filters sheet — mirrors the voice modal's Filtreler sheet */}
          {captionFiltersOpen && (
            <div className="absolute inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
              <button type="button" aria-label="Kapat" onClick={() => setCaptionFiltersOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
              <div className="sheet-in no-scrollbar relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
                <div className="flex-none px-5 pt-5">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className="disp text-[18px] font-semibold text-ink">Filtreler</h3>
                    <button type="button" onClick={() => setCaptionFiltersOpen(false)} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                      <Icon.close width={18} height={18} className="block" />
                    </button>
                  </div>
                </div>
                <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 py-4">
                  <div>
                    <div className="mb-2 text-[13px] font-semibold text-ink">Tür</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CAPTION_FAMILIES.map((f) => (
                        <button key={f.key} type="button" onClick={() => setCaptionFamily(captionFamily === f.label ? "" : f.label)} className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${captionFamily === f.label ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[13px] font-semibold text-ink">Yazı tipi</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CAPTION_FONTS.map((f) => (
                        <button key={f} type="button" onClick={() => setCaptionFontF(captionFontF === f ? "" : f)} style={{ fontFamily: `"${f}", sans-serif` }} className={`rounded-full border px-3 py-1.5 text-[13px] transition ${captionFontF === f ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[13px] font-semibold text-ink">Renk</div>
                    <div className="flex flex-wrap gap-2">
                      {CAPTION_COLORS.map((c) => (
                        <button key={c.hex} type="button" onClick={() => setCaptionColorF(captionColorF === c.hex ? "" : c.hex)} aria-label={c.name} title={c.name} className={`h-7 w-7 rounded-full border-2 transition ${captionColorF === c.hex ? "border-ink" : "border-hairline"}`} style={{ background: c.hex }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3">
                  <button type="button" onClick={() => { setCaptionFamily(""); setCaptionFontF(""); setCaptionColorF(""); }} className="rounded-full border border-hairline px-4 py-2 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink">
                    Temizle
                  </button>
                  <button type="button" onClick={() => setCaptionFiltersOpen(false)} className="btn btn-primary min-w-28">
                    Uygula ({filteredCaptions.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
