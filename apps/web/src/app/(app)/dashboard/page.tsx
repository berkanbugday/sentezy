import Link from "next/link";
import { Icon } from "@/components/icons";

const STATS = [
  { label: "Bu ay üretilen video", value: "12", unit: "", sub: "↑ geçen aya göre 3 fazla", icon: Icon.video, up: true },
  { label: "Kalan kredi", value: "38", unit: "", sub: "50 krediden", icon: Icon.bolt },
  { label: "İşlenen dakika", value: "47", unit: "dk", sub: "bu ay", icon: Icon.clock },
];

const VIDEOS = [
  { title: "Kuaför Studio — Tanıtım", date: "8 Tem", ratio: "9:16", status: "ready" as const },
  { title: "Yeni Sezon İndirimi", date: "8 Tem", ratio: "9:16", status: "proc" as const },
  { title: "Emlak — Deniz Manzaralı", date: "6 Tem", ratio: "9:16", status: "ready" as const },
  { title: "Diş Kliniği Kampanya", date: "5 Tem", ratio: "1:1", status: "draft" as const },
];

const STATUS: Record<string, [string, string]> = {
  ready: ["Hazır", "badge-ready"],
  proc: ["İşleniyor", "badge-proc"],
  draft: ["Taslak", "badge-draft"],
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="disp text-[28px] font-semibold text-ink">Merhaba, Deniz 👋</h1>
      <p className="mt-1 text-[14.5px] text-slate">Bugün ne tanıtalım?</p>

      {/* create CTA */}
      <div className="grad mt-6 flex items-center gap-5 rounded-[18px] px-7 py-6 text-white">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-white/20">
          <Icon.plus width={22} height={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="disp text-[22px] font-semibold">Yeni video oluştur</h3>
          <p className="text-[14.5px] text-white/90">Metni yaz ya da bir link yapıştır — gerisini Sentezy halletsin.</p>
        </div>
        <Link href="/create" className="flex-none rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-ink">Başla →</Link>
      </div>

      {/* stats */}
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="card px-6 py-5">
            <div className="flex items-center gap-2 text-[13px] font-medium text-slate">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-signal" style={{ background: "var(--wash)" }}>
                <s.icon width={17} height={17} />
              </span>
              {s.label}
            </div>
            <div className="disp mt-3 text-[34px] font-semibold leading-none text-ink">
              {s.value}
              {s.unit && <span className="ml-1 text-[16px] text-muted">{s.unit}</span>}
            </div>
            <div className={`mt-2 text-[12px] font-medium ${s.up ? "text-ink" : "text-muted"}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* recent */}
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-ink">Son videoların</h2>
        <Link href="/library" className="text-[13.5px] font-semibold text-signal">Tümünü gör →</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {VIDEOS.map((v) => {
          const [label, cls] = STATUS[v.status];
          return (
            <div key={v.title} className="card overflow-hidden">
              <div className="ph-stripe relative aspect-[9/16]">
                <span className={`badge ${cls} absolute left-2.5 top-2.5`}>
                  <span className="dot" />
                  {label}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-[13.5px] font-semibold text-ink">{v.title}</p>
                <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                  <span>{v.date}</span>
                  <span className="mono">{v.ratio}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
