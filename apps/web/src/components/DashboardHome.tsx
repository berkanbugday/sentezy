"use client";

import { useState } from "react";
import { SettingsDrawer } from "@/components/composer/SettingsDrawer";
import { MediaComposer } from "@/components/MediaComposer";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";

/** Dashboard home: the import composer (hero). Owns the shared settings state. */
export function DashboardHome() {
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS);
  // Lifted out of MediaComposer so the drawer can gate clip-only settings.
  const [mediaCount, setMediaCount] = useState(0);

  return (
    <div>
      <section className="hero-aurora -mx-5 -mt-6 px-5 pb-10 pt-10 sm:-mx-6 sm:px-6 sm:pt-12 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="disp text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">Sentezy&apos;e hoş geldin</h1>
              <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">Medyanı içe aktar ve videonu oluştur</p>
            </div>
            <SettingsDrawer settings={settings} onChange={setSettings} mediaCount={mediaCount} />
          </div>
          <MediaComposer extraSettings={settings} onMediaCountChange={setMediaCount} />
        </div>
      </section>
    </div>
  );
}
