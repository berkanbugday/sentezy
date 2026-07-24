export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-paper p-6">{children}</div>
      <div className="grad relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0" style={{ background: "radial-gradient(600px 400px at 20% 20%, rgba(255,255,255,.28), transparent 60%)" }} />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <div className="disp text-[22px] font-bold tracking-tight">Sentezy</div>
          <div>
            <div className="mx-auto mb-10 aspect-[9/16] w-[220px] rounded-[28px] border border-white/30 bg-white/15 backdrop-blur">
              <div className="mx-auto mt-[34%] h-24 w-24 rounded-full bg-white/80" />
              <div className="mx-4 mt-[38%] space-y-2">
                <div className="h-2.5 w-4/5 rounded-full bg-white/70" />
                <div className="h-2.5 w-3/5 rounded-full bg-white/40" />
              </div>
            </div>
            <p className="disp max-w-[18em] text-[26px] font-semibold leading-snug">
              Turn a link or a couple of sentences into a video that talks.
            </p>
          </div>
          <div className="text-[13px] text-white/70">© 2026 Sentezy</div>
        </div>
      </div>
    </div>
  );
}
