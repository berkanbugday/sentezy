"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "./icons";

/** Upload-first hero composer (mirrors the reference's "Import or drag your video").
 *  Picking a file is optional — the wizard is the real engine, so "Videomu oluştur"
 *  always proceeds to /create. Actual upload wiring is deferred. */
export function MediaComposer() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFiles(files: FileList | null) {
    if (files && files[0]) setFile(files[0]);
  }

  return (
    <div className="mt-7 rounded-[22px] border border-hairline bg-paper p-3.5 shadow-sm">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed px-6 py-16 text-center transition ${
          drag ? "border-ink bg-mist" : "border-hairline hover:bg-mist/60"
        }`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-slate">
          <Icon.plus width={24} height={24} />
        </span>
        {file ? (
          <div>
            <p className="text-[14px] font-semibold text-ink">{file.name}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Hazır — oluşturmak için devam et</p>
          </div>
        ) : (
          <div>
            <p className="text-[14.5px] font-medium text-ink">Videonu sürükle ya da yükle</p>
            <p className="mt-0.5 text-[12.5px] text-muted">(.mp4, .mov)</p>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <div className="mt-3 flex items-center gap-2 px-1">
        <button type="button" className="btn btn-ghost h-9 !py-0 text-[13px]">
          <Icon.wand width={16} height={16} />
          Stil ekle
        </button>
        <button type="button" onClick={() => router.push("/create")} className="btn btn-primary ml-auto">
          Videomu oluştur
          <Icon.arrowRight width={17} height={17} />
        </button>
      </div>
    </div>
  );
}
