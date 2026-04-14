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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="集成" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {overview.stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="console-panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="text-sm font-semibold">授权</div>
        </div>
        <div className="space-y-2 p-3">
          {overview.integrations.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
              {overview.emptySummary}
            </div>
          ) : (
            overview.integrations.map((integration) => (
              <div
                key={integration.id}
                className="rounded-2xl border border-transparent bg-secondary/20 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{integration.providerLabel}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {integration.accountLabel}
                    </div>
                  </div>
                  <Badge variant={integration.statusTone === 'danger' ? 'destructive' : 'outline'}>
                    {integration.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {integration.capabilityLabels.length > 0
                    ? integration.capabilityLabels.join(' · ')
                    : '暂无能力快照'}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                    {integration.repositoryCountLabel}
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                    {integration.boundProjectsLabel}
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{integration.summary}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="console-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">仓库记录</div>
          </div>
          <div className="space-y-2 p-3">
            {overview.repositories.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                暂无仓库
              </div>
            ) : (
              overview.repositories.map((repository) => (
                <div
                  key={repository.id}
                  className="rounded-2xl border border-transparent bg-secondary/20 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{repository.fullName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {repository.providerLabel} · 默认分支 {repository.defaultBranchLabel}
                      </div>
                    </div>
                    {repository.webUrl ? (
                      <Button asChild variant="outline" className="h-8 rounded-xl px-3">
                        <a href={repository.webUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          链接
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {repository.usageSummary}
                  </div>
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

        <div className="console-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">团队范围</div>
          </div>
          <div className="space-y-2 p-3">
            {overview.teamScopes.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                暂无团队
              </div>
            ) : (
              overview.teamScopes.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-transparent bg-secondary/20 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-background p-3">
                      <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{team.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        @{team.slug} · {team.roleLabel}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">{team.summary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
