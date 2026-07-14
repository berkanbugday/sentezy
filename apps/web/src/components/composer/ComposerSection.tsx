"use client";

import { useState } from "react";
import { MediaComposer } from "@/components/MediaComposer";
import { type ComposerSettings, DEFAULT_SETTINGS } from "@/lib/composerSettings";
import { SettingsDrawer } from "./SettingsDrawer";

/** Dashboard hero: heading + the extra-settings drawer trigger, sharing settings state
 *  down into the composer so they ride along in the create payload. */
export function ComposerSection() {
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS);
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="disp text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">Sentezy&apos;e hoş geldin</h1>
          <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">Medyanı içe aktar ve bir stil seç</p>
        </div>
        <SettingsDrawer settings={settings} onChange={setSettings} />
      </div>
      <MediaComposer extraSettings={settings} />
    </>
  );
}
