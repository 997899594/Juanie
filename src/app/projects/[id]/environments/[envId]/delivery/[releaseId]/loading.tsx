function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[20px] bg-[rgba(15,23,42,0.06)] ${className}`} />;
}

export default function ReleaseDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-3">
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-5 w-72 max-w-full" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {['status', 'environment', 'deployments', 'migrations'].map((item) => (
          <SkeletonBlock key={item} className="h-28" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>

      <SkeletonBlock className="h-80" />
    </div>
  );
}
