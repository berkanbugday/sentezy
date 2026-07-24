import Link from "next/link";
import { Icon } from "@/components/icons";

/** Global 404. Echoes the app shell (soft-dark `--frame` behind a white inset panel)
 *  and the dashboard hero (`hero-aurora` header) so it reads as one system. Renders in
 *  the root layout, so it covers any unmatched URL whether or not the user is signed in. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center [background:var(--frame)] p-5">
      <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-hairline bg-paper shadow-2xl">
        {/* aurora header — same wash the dashboard hero uses */}
        <div className="hero-aurora px-8 pb-9 pt-10 text-center">
          <span className="disp text-[15px] font-bold tracking-tight text-ink">Sentezy</span>
          <p className="disp mt-4 text-[76px] font-bold leading-none tracking-tight text-ink">404</p>
        </div>

        {/* message + actions on the white panel */}
        <div className="px-8 pb-8 pt-7 text-center">
          <h1 className="disp text-[19px] font-semibold text-ink">Page not found</h1>
          <p className="mx-auto mt-2 max-w-[19em] text-[14px] leading-relaxed text-slate">
            This page has moved or never existed. Head back and pick up where you left off.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link href="/dashboard" className="btn btn-primary w-full justify-center sm:w-auto">
              <Icon.home width={16} height={16} />
              Back to the composer
            </Link>
            <Link href="/library" className="btn btn-ghost w-full justify-center sm:w-auto">
              Your videos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
