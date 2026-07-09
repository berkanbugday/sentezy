"use client";

import { useRef, useState } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { estimateDuration, toWords } from "@/hooks/useCaptionPlayback";
import type { MusicTrack } from "@/lib/queries";
import type { CreateReelValues } from "@/lib/schemas";

export type Voice = { id: string; label: string; gender: string | null; style: string | null; previewUrl?: string | null };
export type Presenter = { id: string; name: string; status: string; imageUrl?: string | null; sourceImageId?: string | null };

type Common = {
  register: UseFormRegister<CreateReelValues>;
  errors: FieldErrors<CreateReelValues>;
  values: CreateReelValues;
  setValue: (name: keyof CreateReelValues, value: CreateReelValues[keyof CreateReelValues], opts?: object) => void;
};

const fieldClass =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-signal";

const SAMPLE =
  "Yeni sezon koleksiyonumuz geldi! Bu hafta sana özel indirimleri kaçırma. Hemen mağazamıza uğra, favori parçalarını keşfet.";

/* ── 01 · Başlık & Arka plan — title + background images ──────────────── */
export type BgImage = { id: string; url: string };

export function SetupStep({
  register,
  errors,
  bgImages,
  onUpload,
  onRemove,
}: Common & {
  bgImages: BgImage[];
  onUpload: (files: FileList) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-ink">Başlık</label>
        <input className={fieldClass} placeholder="Örn: Kuaför tanıtımı" {...register("title")} />
        {errors.title && <p className="mt-1 text-[12.5px] text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-ink">B-roll görselleri</label>
        <p className="mb-2.5 text-[12px] text-muted">Görselleri yükle — sunucu konuşurken otomatik olarak araya girerler. Düzenleme yok.</p>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
          {bgImages.map((img) => (
            <div key={img.id} className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-hairline">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-mist text-[10px] text-muted">Görsel</div>
              )}
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                aria-label="Kaldır"
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[13px] leading-none text-white transition hover:bg-black/80"
              >
                ×
              </button>
            </div>
          ))}
          <label className="flex aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline bg-mist text-center transition hover:border-signal">
            <span className="text-[20px] text-muted">{busy ? "…" : "＋"}</span>
            <span className="px-1 text-[10px] font-medium text-muted">Görsel ekle</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const fs = e.target.files;
                if (!fs?.length) return;
                setBusy(true);
                try {
                  await onUpload(fs);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ── 04 · Senaryo — the video's spoken script ─────────────────────────── */
export function ScriptStep({ register, errors, values, setValue }: Common) {
  const chars = values.script?.length ?? 0;
  const words = toWords(values.script ?? "").length;
  const secs = estimateDuration(values.script ?? "");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[13px] font-medium text-ink">Senaryo</label>
          <button
            type="button"
            onClick={() => setValue("script", SAMPLE, { shouldValidate: true })}
            className="text-[12px] font-medium text-signal hover:underline"
          >
            Örnek metni dene
          </button>
        </div>
        <textarea
          rows={9}
          className={`${fieldClass} resize-y leading-relaxed`}
          placeholder="Videonun konuşma metnini yaz — sağdaki önizlemede anında görünsün…"
          {...register("script")}
        />
        <div className="mt-1.5 flex justify-between text-[12px] text-muted">
          <span>{errors.script && <span className="text-red-600">{errors.script.message}</span>}</span>
          <span className="mono">{words} kelime · {chars} karakter · ~{secs.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

/* ── 02 · Avatar — pick from the 100-presenter library (no upload) ─────── */
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

const AGE_LABEL: Record<Avatar["age"], string> = { genç: "Genç", yetişkin: "Yetişkin", olgun: "Olgun" };

export function AvatarStep({
  avatars,
  selectedImageUrl,
  selectedName,
  onSelect,
  busy,
  error,
}: {
  avatars: Avatar[];
  selectedImageUrl?: string | null;
  selectedName?: string | null;
  onSelect: (a: Avatar) => void;
  busy?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const readyCount = avatars.filter((a) => a.ready).length;
  return (
    <div>
      <p className="mb-4 text-[13px] text-slate">
        Videoda konuşacak AI sunucuyu seç — {avatars.length} sektörel avatar, sektöre ve profile göre filtrele.
      </p>
      {selectedImageUrl ? (
        <div className="flex items-center gap-4">
          <div className="h-28 w-24 overflow-hidden rounded-2xl border border-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImageUrl} alt={selectedName ?? ""} className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink">{selectedName}</div>
            <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-[13px] font-medium text-signal hover:underline">
              Değiştir
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-mist py-10 text-[14px] font-medium text-slate transition hover:border-signal"
        >
          <span className="text-[18px]">＋</span> Avatar kütüphanesini aç
        </button>
      )}
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}

      {open && (
        <AvatarModal
          avatars={avatars}
          readyCount={readyCount}
          selectedImageUrl={selectedImageUrl}
          busy={busy}
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onSelect(a);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
    active ? "border-signal bg-[var(--wash)] text-signal" : "border-hairline text-ink hover:border-signal/50"
  }`;
}

function AvatarModal({
  avatars,
  readyCount,
  selectedImageUrl,
  busy,
  onClose,
  onPick,
}: {
  avatars: Avatar[];
  readyCount: number;
  selectedImageUrl?: string | null;
  busy?: boolean;
  onClose: () => void;
  onPick: (a: Avatar) => void;
}) {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"" | Avatar["gender"]>("");
  const [age, setAge] = useState<"" | Avatar["age"]>("");
  const [sector, setSector] = useState("");

  // Sectors present in the library, in catalog order — for the dropdown.
  const sectors = [...new Map(avatars.map((a) => [a.sector, a.sectorLabel])).entries()];
  const q = search.trim().toLocaleLowerCase("tr");
  const filtered = avatars.filter(
    (a) =>
      (!gender || a.gender === gender) &&
      (!age || a.age === age) &&
      (!sector || a.sector === sector) &&
      (!q || a.name.toLocaleLowerCase("tr").includes(q) || a.sectorLabel.toLocaleLowerCase("tr").includes(q)),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h3 className="disp text-[17px] font-semibold text-ink">Avatar kütüphanesi</h3>
            <p className="text-[12px] text-muted">{readyCount} hazır · {avatars.length} avatar</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-[18px] text-muted transition hover:bg-mist">
            ×
          </button>
        </div>

        {/* filters */}
        <div className="flex flex-col gap-3 border-b border-hairline px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya sektör ara…"
              className="min-w-[160px] flex-1 rounded-full border border-hairline bg-mist px-3.5 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal"
            />
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="rounded-full border border-hairline bg-mist px-3 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal"
            >
              <option value="">Tüm sektörler</option>
              {sectors.map(([slug, label]) => (
                <option key={slug} value={slug}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setGender("")} className={chipClass(!gender)}>Herkes</button>
            <button type="button" onClick={() => setGender("kadın")} className={chipClass(gender === "kadın")}>Kadın</button>
            <button type="button" onClick={() => setGender("erkek")} className={chipClass(gender === "erkek")}>Erkek</button>
            <span className="mx-1 h-4 w-px bg-hairline" />
            <button type="button" onClick={() => setAge("")} className={chipClass(!age)}>Tüm yaşlar</button>
            {(["genç", "yetişkin", "olgun"] as const).map((a) => (
              <button key={a} type="button" onClick={() => setAge(a)} className={chipClass(age === a)}>{AGE_LABEL[a]}</button>
            ))}
          </div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((a) => {
            const active = a.ready && selectedImageUrl === a.imageUrl;
            return (
              <button
                key={a.slug}
                type="button"
                disabled={busy || !a.ready}
                title={a.ready ? a.name : `${a.name} — yakında`}
                onClick={() => a.ready && onPick(a)}
                className={`group overflow-hidden rounded-2xl border text-left transition disabled:cursor-not-allowed ${
                  active ? "border-signal ring-2 ring-signal/30" : "border-hairline hover:border-signal/50"
                } ${!a.ready ? "opacity-55" : ""}`}
              >
                <div className="relative aspect-[3/4] w-full bg-mist">
                  {a.ready ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                      <span className="disp text-[26px] font-semibold text-muted">{a.name.charAt(0)}</span>
                      <span className="rounded-full bg-black/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">Yakında</span>
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <div className="truncate text-[13px] font-semibold text-ink">{a.name}</div>
                  <div className="truncate text-[11px] text-muted">{a.sectorLabel}</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-[13px] text-muted">
              {avatars.length === 0 ? "Avatarlar yükleniyor…" : "Bu filtrelere uygun avatar yok."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 03 · Ses & dil ───────────────────────────────────────────────────── */
export function VoiceStep({
  voices,
  selected,
  onSelect,
  error,
}: {
  voices: Voice[];
  selected?: string;
  onSelect: (id: string) => void;
  error?: string;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function sample(v: Voice) {
    if (!v.previewUrl) return;
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (playingId === v.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = v.previewUrl;
    audio.onended = () => setPlayingId(null);
    void audio.play();
    setPlayingId(v.id);
  }

  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {voices.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
              selected === v.id ? "border-signal bg-[var(--wash)]" : "border-hairline bg-paper hover:border-signal/50"
            }`}
          >
            {v.previewUrl && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); sample(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); sample(v); } }}
                aria-label="Sesi dinle"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:opacity-90"
              >
                {playingId === v.id ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{v.label}</span>
              <span className="block truncate text-[12px] text-muted">{[v.gender, v.style].filter(Boolean).join(" · ")}</span>
            </span>
            <Waveform active={selected === v.id || playingId === v.id} />
          </button>
        ))}
        {voices.length === 0 && <p className="text-[13px] text-muted">Sesler yükleniyor…</p>}
      </div>
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [8, 14, 6, 16, 10, 13, 7];
  return (
    <span className="flex h-5 items-center gap-[3px]">
      {bars.map((hgt, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-colors"
          style={{ height: hgt, background: active ? "var(--color-signal)" : "var(--color-hairline)" }}
        />
      ))}
    </span>
  );
}

/* ── 04 · Biçim ───────────────────────────────────────────────────────── */
const RATIOS: { value: CreateReelValues["aspectRatio"]; label: string; w: number; h: number }[] = [
  { value: "9:16", label: "Reels · Story", w: 18, h: 32 },
  { value: "1:1", label: "Kare · Feed", w: 28, h: 28 },
  { value: "16:9", label: "Yatay · YouTube", w: 34, h: 19 },
];

export function FormatStep({ register, values, setValue, music }: Common & { music: MusicTrack[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  function sample(t: MusicTrack) {
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (playingKey === t.key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }
    audio.src = t.previewUrl;
    audio.onended = () => setPlayingKey(null);
    void audio.play();
    setPlayingKey(t.key);
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Oran</label>
        <div className="grid grid-cols-3 gap-3">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setValue("aspectRatio", r.value)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition ${
                values.aspectRatio === r.value ? "border-signal bg-[var(--wash)]" : "border-hairline hover:border-signal/50"
              }`}
            >
              <span
                className="rounded-[4px] border-2"
                style={{
                  width: r.w,
                  height: r.h,
                  borderColor: values.aspectRatio === r.value ? "var(--color-signal)" : "var(--color-muted)",
                }}
              />
              <span className="mono text-[12px] font-semibold text-ink">{r.value}</span>
              <span className="text-[11px] text-muted">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-hairline px-4 py-3">
        <span>
          <span className="block text-[14px] font-medium text-ink">Otomatik altyazı</span>
          <span className="block text-[12px] text-muted">Konuşma metni videoya işlenir</span>
        </span>
        <input type="checkbox" {...register("captions")} className="h-5 w-5 accent-[var(--color-signal)]" />
      </label>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Yerleşim</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mb-1.5 block text-[12px] text-muted">Sunucu tarafı</span>
            <div className="flex gap-2">
              {(["left", "right"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setValue("avatarSide", s)} className={chipClass(values.avatarSide === s)}>
                  {s === "left" ? "◧ Sol" : "Sağ ◨"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] text-muted">Altyazı</span>
            <div className="flex gap-2">
              {(["top", "bottom"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setValue("captionPosition", p)} className={chipClass(values.captionPosition === p)}>
                  {p === "top" ? "Üst" : "Alt"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Müzik</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setValue("musicTrackKey", undefined)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              !values.musicTrackKey ? "border-signal bg-[var(--wash)] text-signal" : "border-hairline text-ink hover:border-signal/50"
            }`}
          >
            Yok
          </button>
          {music.map((t) => {
            const active = values.musicTrackKey === t.key;
            return (
              <div
                key={t.key}
                className={`flex items-center gap-2 rounded-full border py-1 pl-3.5 pr-1 transition ${
                  active ? "border-signal bg-[var(--wash)]" : "border-hairline hover:border-signal/50"
                }`}
              >
                <button type="button" onClick={() => setValue("musicTrackKey", t.key)} className="text-[13px] font-medium text-ink">
                  {t.name}
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Dinle"
                  onClick={() => sample(t)}
                  onKeyDown={(e) => e.key === "Enter" && sample(t)}
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-ink text-paper transition hover:opacity-90"
                >
                  {playingKey === t.key ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 05 · Önizle ──────────────────────────────────────────────────────── */
export function ReviewStep({
  values,
  presenterName,
  voiceLabel,
  submitError,
}: {
  values: CreateReelValues;
  presenterName: string;
  voiceLabel: string;
  submitError: string | null;
}) {
  const rows: [string, string][] = [
    ["Başlık", values.title || "—"],
    ["Sunucu", presenterName],
    ["Ses", voiceLabel],
    ["Oran", values.aspectRatio],
    ["Altyazı", values.captions ? "Açık" : "Kapalı"],
    ["Süre", `~${estimateDuration(values.script ?? "").toFixed(1)}s`],
  ];
  return (
    <div className="flex flex-col gap-3 text-[14px]">
      <p className="text-[13px] text-slate">Her şey hazır. Oluşturunca videon işlenmeye başlar.</p>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-hairline pb-2">
          <span className="text-muted">{k}</span>
          <span className="font-semibold text-ink">{v}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between rounded-xl bg-mist px-4 py-3">
        <span className="text-[13px] text-slate">Kredi maliyeti</span>
        <span className="text-[13px] font-semibold text-ink">1 kredi</span>
      </div>
      {submitError && <p className="text-[12.5px] text-red-600">{submitError}</p>}
    </div>
  );
}
