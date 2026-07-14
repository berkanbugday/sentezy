export function VoiceSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline p-2">
      <span className="h-9 w-9 flex-none animate-pulse rounded-full bg-mist" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/3 animate-pulse rounded bg-mist" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-mist" />
      </div>
    </div>
  );
}
