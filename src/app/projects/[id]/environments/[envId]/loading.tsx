function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[20px] bg-[rgba(15,23,42,0.06)] ${className}`} />;
}

export default function EnvironmentRouteLoading() {
  const navSkeletonIds = ['overview', 'delivery', 'schema', 'variables', 'logs', 'diagnostics'];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-3">
        <SkeletonBlock className="h-10 w-40" />
        <SkeletonBlock className="h-5 w-80 max-w-full" />
      </div>

      <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,244,239,0.9))] px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,0.84)_inset,0_10px_26px_rgba(55,53,47,0.05)]">
        <div className="flex flex-wrap gap-2">
          {navSkeletonIds.map((item) => (
            <SkeletonBlock key={item} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-44" />
        <SkeletonBlock className="h-44" />
      </div>

      <SkeletonBlock className="h-56" />
    </div>
  );
}
