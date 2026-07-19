"use client";

import { useState } from "react";
import { AvatarGrid } from "@/components/composer/AvatarGrid";
import { AvatarPreview } from "@/components/AvatarPreview";
import { type Avatar } from "@/components/wizard/types";

/** The avatar catalog as a full page: browse, then start a video with one.
 *  The grid is shared with the composer's picker sheet. */
export function AvatarsView() {
  const [previewing, setPreviewing] = useState<Avatar | null>(null);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="disp text-[28px] font-semibold text-ink">Avatarlar</h1>
        <p className="mt-1 text-[14.5px] text-slate">Videon için bir avatar seç.</p>
      </div>

      <AvatarGrid surface="page" onSelect={(a) => setPreviewing(a)} />
      <AvatarPreview avatar={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
