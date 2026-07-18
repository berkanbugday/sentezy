"use client";

import { useEffect, useState } from "react";
import { RATIOS, VOICE_EMOTIONS } from "@/components/wizard/constants";
import { Icon } from "@/components/icons";
import { type ComposerSettings } from "@/lib/composerSettings";
import { useMusic } from "@/lib/queries";

type Opt<T> = { value: T; label: string };

function Pills<T extends string>({ options, value, onChange }: { options: readonly Opt<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${value === o.value ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-ink">{label}</div>
      {children}
    </div>
  );
}

const LAYOUT_OPTS: Opt<ComposerSettings["avatarLayout"]>[] = [
  { value: "side", label: "Kenar" },
  { value: "bottom", label: "Alt" },
];
const SIDE_OPTS: Opt<ComposerSettings["avatarSide"]>[] = [
  { value: "left", label: "Sol" },
  { value: "right", label: "Sağ" },
];
const CAPPOS_OPTS: Opt<ComposerSettings["captionPosition"]>[] = [
  { value: "top", label: "Üst" },
  { value: "bottom", label: "Alt" },
];

/** Icon button that opens an animated right-side drawer of extra video settings. */
export function SettingsDrawer({ settings, onChange }: { settings: ComposerSettings; onChange: (s: ComposerSettings) => void }) {
  const [open, setOpen] = useState(false);
  const musicQ = useMusic(open); // only fetch once the drawer is opened
  const tracks = musicQ.data ?? [];
  const set = <K extends keyof ComposerSettings>(k: K, v: ComposerSettings[K]) => onChange({ ...settings, [k]: v });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Ek ayarlar"
        aria-expanded={open}
        title="Ek ayarlar"
        className={`flex flex-none items-center justify-center rounded-full border p-2.5 transition ${open ? "border-ink bg-ink text-paper" : "border-hairline bg-paper text-ink hover:bg-mist"}`}
      >
        <Icon.settings width={17} height={17} />
      </button>

      {open && (
        <aside className="drawer-in no-scrollbar fixed inset-y-2.5 right-2.5 z-50 flex w-[330px] max-w-[86vw] flex-col overflow-y-auto rounded-[24px] border border-hairline bg-paper shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-paper px-5 py-4">
            <h3 className="disp text-[17px] font-semibold text-ink">Ek ayarlar</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>

          <div className="flex flex-col gap-5 px-5 py-5">
              <Field label="En / boy">
                <Pills options={RATIOS.map((r) => ({ value: r.value, label: r.label }))} value={settings.aspectRatio} onChange={(v) => set("aspectRatio", v)} />
              </Field>
              <Field label="Avatar yerleşimi">
                <Pills options={LAYOUT_OPTS} value={settings.avatarLayout} onChange={(v) => set("avatarLayout", v)} />
              </Field>
              <Field label="Avatar tarafı">
                <Pills options={SIDE_OPTS} value={settings.avatarSide} onChange={(v) => set("avatarSide", v)} />
              </Field>
              <Field label="Altyazı konumu">
                <Pills options={CAPPOS_OPTS} value={settings.captionPosition} onChange={(v) => set("captionPosition", v)} />
              </Field>
              <Field label="Ses tonu">
                <Pills options={VOICE_EMOTIONS} value={settings.voiceEmotion} onChange={(v) => set("voiceEmotion", v)} />
              </Field>
              <Field label="Müzik">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => set("musicTrackKey", undefined)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${!settings.musicTrackKey ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
                  >
                    Yok
                  </button>
                  {tracks.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => set("musicTrackKey", t.key)}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${settings.musicTrackKey === t.key ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
                    >
                      {t.name}
                    </button>
                  ))}
                  {musicQ.isLoading && <span className="text-[12px] text-muted">Yükleniyor…</span>}
                </div>
                {settings.musicTrackKey && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11.5px] text-muted">
                      <span>Müzik seviyesi</span>
                      <span className="mono">{Math.round(settings.musicVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.4}
                      step={0.01}
                      value={settings.musicVolume}
                      onChange={(e) => set("musicVolume", Number(e.target.value))}
                      className="w-full accent-ink"
                    />
                  </div>
                )}
              </Field>
              <Field label="Geçiş efekti sesi">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.transitionSfx}
                  onClick={() => set("transitionSfx", !settings.transitionSfx)}
                  className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
                >
                  <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${settings.transitionSfx ? "bg-ink" : "bg-hairline"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.transitionSfx ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                  {settings.transitionSfx ? "Açık" : "Kapalı"}
                </button>
              </Field>
              <Field label="Yapay zekâ ses efektleri">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.sfxEnabled}
                  onClick={() => set("sfxEnabled", !settings.sfxEnabled)}
                  className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
                >
                  <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${settings.sfxEnabled ? "bg-ink" : "bg-hairline"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.sfxEnabled ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                  {settings.sfxEnabled ? "Açık" : "Kapalı"}
                </button>
              </Field>
          </div>
        </aside>
      )}
    </>
  );
}
