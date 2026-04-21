'use client';

import { ExternalLink, FolderGit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import type { getIntegrationsControlPlanePageData } from '@/lib/settings/integrations-service';

interface IntegrationsControlPlaneClientProps {
  initialData: Awaited<ReturnType<typeof getIntegrationsControlPlanePageData>>;
}

export function IntegrationsControlPlaneClient({
  initialData,
}: IntegrationsControlPlaneClientProps) {
  const overview = initialData.overview;
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';
  const subtleClassName =
    'rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="集成" />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {overview.stats.map((stat) => (
          <div key={stat.label} className={`${subtleClassName} rounded-[20px]`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className={`${shellClassName} overflow-hidden`}>
        <div className="console-divider-bottom px-5 py-4">
          <div className="text-sm font-semibold">授权</div>
        </div>
        <div className="space-y-2 p-3">
          {overview.integrations.length === 0 ? (
            <div
              className={`${subtleClassName} flex min-h-40 items-center justify-center text-sm text-muted-foreground`}
            >
              {overview.emptySummary}
            </div>
          ) : (
            overview.integrations.map((integration) => (
              <div key={integration.id} className={`${subtleClassName} px-4 py-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{integration.providerLabel}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {integration.accountLabel}
                    </div>
                  </div>
                  <Badge
                    variant={integration.statusTone === 'danger' ? 'destructive' : 'secondary'}
                  >
                    {integration.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {integration.capabilityLabels.length > 0
                    ? integration.capabilityLabels.join(' · ')
                    : '暂无能力快照'}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className={`${subtleClassName} px-3 py-3 text-xs text-muted-foreground`}>
                    {integration.repositoryCountLabel}
                  </div>
                  <div className={`${subtleClassName} px-3 py-3 text-xs text-muted-foreground`}>
                    {integration.boundProjectsLabel}
                  </div>
                </div>
                {integration.summary ? (
                  <div className="mt-3 text-xs text-muted-foreground">{integration.summary}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={`${shellClassName} overflow-hidden`}>
          <div className="console-divider-bottom px-5 py-4">
            <div className="text-sm font-semibold">仓库记录</div>
          </div>
          <div className="space-y-2 p-3">
            {overview.repositories.length === 0 ? (
              <div
                className={`${subtleClassName} flex min-h-40 items-center justify-center text-sm text-muted-foreground`}
              >
                暂无仓库
              </div>
            ) : (
              overview.repositories.map((repository) => (
                <div key={repository.id} className={`${subtleClassName} px-4 py-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{repository.fullName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {repository.providerLabel} · 默认分支 {repository.defaultBranchLabel}
                      </div>
                    </div>
                    {repository.webUrl ? (
                      <Button asChild variant="ghost" className="h-8 rounded-full px-3">
                        <a href={repository.webUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          链接
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  {repository.usageSummary ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {repository.usageSummary}
                    </div>
                  ) : null}
                  {repository.projectLinks.length > 0 && (
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      关联项目：
                      {repository.projectLinks.map((project) => project.name).join(' · ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${shellClassName} overflow-hidden`}>
          <div className="console-divider-bottom px-5 py-4">
            <div className="text-sm font-semibold">团队范围</div>
          </div>
          <div className="space-y-2 p-3">
            {overview.teamScopes.length === 0 ? (
              <div
                className={`${subtleClassName} flex min-h-40 items-center justify-center text-sm text-muted-foreground`}
              >
                暂无团队
              </div>
            ) : (
              overview.teamScopes.map((team) => (
                <div key={team.id} className={`${subtleClassName} px-4 py-4`}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-[18px] bg-white/82 p-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
                      <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{team.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        @{team.slug} · {team.roleLabel}
                      </div>
                    </div>
                  </div>
                  {team.summary ? (
                    <div className="mt-3 text-xs text-muted-foreground">{team.summary}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
