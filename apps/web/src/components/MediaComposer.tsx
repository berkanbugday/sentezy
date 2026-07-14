"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUploadBackground, useUploadBackgroundVideo } from "@/lib/queries";
import { Icon } from "./icons";
import { DEFAULT_TRANSITION, TRANSITIONS } from "./WizardSteps";

type Status = "uploading" | "done" | "error";
type Media = { url: string; name: string; kind: "image" | "video"; file: File; status: Status; ref?: string; serverUrl?: string; poster?: string };

const PENDING_KEY = "sentezy:pending-media";

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

/** Map an xfade transition value to a preview-animation family class. */
function tpClass(v: string): string {
  if (v === "cut") return "tp-cut";
  if (/(tl|tr|bl|br)$/.test(v)) return "tp-diag";
  if (v.startsWith("circle")) return "tp-circle";
  if (["rectcrop", "horzopen", "horzclose", "vertopen", "vertclose"].includes(v)) return "tp-box";
  if (["zoomin", "distance", "squeezev", "squeezeh"].includes(v)) return "tp-zoom";
  const slide = v.startsWith("slide") || v.startsWith("smooth");
  const wipe = v.startsWith("wipe") || v.endsWith("slice");
  if (slide || wipe) {
    const base = slide ? "tp-slide" : "tp-wipe";
    if (v.includes("left") || v.startsWith("hl")) return `${base}-l`;
    if (v.includes("right") || v.startsWith("hr")) return `${base}-r`;
    if (v.includes("up") || v.startsWith("vu")) return `${base}-u`;
    if (v.includes("down") || v.startsWith("vd")) return `${base}-d`;
    return `${base}-l`;
  }
  return "tp-fade"; // fade, fadeblack/white/grays, dissolve, pixelize, radial
}

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
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
  const [transition, setTransition] = useState(DEFAULT_TRANSITION);
  const [effectOpen, setEffectOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The transition effect only applies between 2+ media — close/hide otherwise.
  const multiple = items.length > 1;
  useEffect(() => {
    if (!multiple) setEffectOpen(false);
  }, [multiple]);
  const currentLabel = TRANSITIONS.flatMap((g) => g.items).find((t) => t.value === transition)?.label ?? "";

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
      if (kind) next.push({ url: URL.createObjectURL(f), name: f.name, kind, file: f, status: "uploading" });
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
  const pick = () => inputRef.current?.click();

  function create() {
    const ready = items.filter((i) => i.status === "done" && i.ref);
    try {
      if (ready.length) {
        // one media = no transition needed; 2+ carry the chosen slide effect
        const tr = multiple ? transition : DEFAULT_TRANSITION;
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(ready.map((i) => ({ ref: i.ref, url: i.serverUrl, kind: i.kind, transition: tr }))));
      } else sessionStorage.removeItem(PENDING_KEY);
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
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
          {items.map((m) => (
            <div key={m.url} className="group relative aspect-square overflow-hidden rounded-xl border border-hairline bg-mist">
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
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Icon.close width={15} height={15} className="block" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={pick}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline text-muted transition hover:bg-mist hover:text-slate"
          >
            <Icon.plus width={22} height={22} />
            <span className="text-[11px] font-medium">Ekle</span>
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="video/*,image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      <div className="mt-3 flex flex-col gap-2.5 px-1 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={pick} className="btn btn-ghost h-9 !py-0 text-[13px]">
            <Icon.wand width={16} height={16} />
            Stil ekle
          </button>
          {multiple && (
            <button type="button" onClick={() => setEffectOpen(true)} className="slide-in btn btn-ghost h-9 !py-0 text-[13px]">
              Geçiş: {currentLabel}
              <Icon.chevronDown width={14} height={14} className="text-muted" />
            </button>
          )}
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
          disabled={uploading}
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
                </div>
                <button type="button" onClick={() => setEffectOpen(false)} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
                  <Icon.close width={18} height={18} className="block" />
                </button>
              </div>
              <p className="mb-1 text-[12.5px] text-muted">Slaytlar arası geçiş</p>
            </div>

            <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 py-4">
              {TRANSITIONS.map((g) => (
                <div key={g.group}>
                  <div className="mb-2 text-[12px] font-semibold text-slate">{g.group}</div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {g.items.map((it) => {
                      const sel = transition === it.value;
                      return (
                        <button
                          key={it.value}
                          type="button"
                          onClick={() => setTransition(it.value)}
                          className={`overflow-hidden rounded-xl border p-1.5 text-left transition ${sel ? "border-ink ring-1 ring-ink" : "border-hairline hover:bg-mist"}`}
                        >
                          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-mist">
                            <span className="tp-a" />
                            <span className={`tp-b ${tpClass(it.value)}`} />
                            {sel && (
                              <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m5 12 5 5L20 7" />
                                </svg>
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 truncate px-0.5 text-[11.5px] font-medium text-ink">{it.label}</div>
                        </button>
                      );
                    })}
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
    </div>
  );
}
