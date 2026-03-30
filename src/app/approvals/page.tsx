import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Database,
  FolderKanban,
  GitBranch,
  TerminalSquare,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { getApprovalsPageData } from '@/lib/approvals/service';
import {
  buildApprovalsFilterHref,
  formatApprovalStatusLabel,
  normalizeApprovalFilterState,
} from '@/lib/approvals/view';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const migrationStatusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean }
> = {
  queued: { color: 'neutral', pulse: false },
  awaiting_approval: { color: 'warning', pulse: false },
  planning: { color: 'info', pulse: true },
  running: { color: 'info', pulse: true },
  success: { color: 'success', pulse: false },
  failed: { color: 'error', pulse: false },
  canceled: { color: 'neutral', pulse: false },
  skipped: { color: 'neutral', pulse: false },
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { state } = await searchParams;
  const filterState = normalizeApprovalFilterState(state);

  const memberships = await db.query.teamMembers.findMany({
    where: (member, { eq }) => eq(member.userId, session.user.id),
    with: {
      team: true,
    },
  });

  const teamIds = memberships.map((membership) => membership.teamId);
  const { stats, attentionRuns } = await getApprovalsPageData({
    teamIds,
    filterState,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="审批" description="需要人工处理的迁移" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="console-panel px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            筛选
          </div>
          <Button asChild variant={filterState === 'all' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('all')}>全部</Link>
          </Button>
          <Button asChild variant={filterState === 'approval' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('approval')}>待审批</Link>
          </Button>
          <Button asChild variant={filterState === 'failed' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('failed')}>失败</Link>
          </Button>
          <Button asChild variant={filterState === 'canceled' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('canceled')}>已取消</Link>
          </Button>
        </div>
      </div>

      {attentionRuns.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12" />}
          title="没有待处理迁移"
          description="当前筛选条件下为空。"
        />
      ) : (
        <div className="space-y-3">
          {attentionRuns.map((run) => {
            const statusConfig = migrationStatusConfig[run.status] || migrationStatusConfig.queued;

            return (
              <div key={run.id} className="console-panel overflow-hidden">
                <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={statusConfig.color}
                        pulse={statusConfig.pulse}
                        label={formatApprovalStatusLabel(run.status)}
                      />
                      <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                        {run.project.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {[
                          run.environment.name,
                          run.previewSourceMeta.label,
                          run.database.name,
                          run.specification.phase,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-base font-semibold">
                        {run.service?.name ?? 'service'} · {run.specification.tool}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{run.createdAtLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Database className="h-3.5 w-3.5" />
                          <span>{run.database.type}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5" />
                          <span>{run.branchLabel}</span>
                        </div>
                      </div>
                      {run.platformSignals.primarySummary && (
                        <div className="text-sm text-foreground">
                          {run.platformSignals.primarySummary}
                        </div>
                      )}
                      {run.platformSignals.nextActionLabel && (
                        <div className="text-xs text-muted-foreground">
                          下一步：{run.platformSignals.nextActionLabel}
                        </div>
                      )}
                    </div>

                    <div className="console-card bg-secondary/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        <TerminalSquare className="h-3.5 w-3.5" />
                        命令
                      </div>
                      <div className="break-all font-mono text-xs">{run.specification.command}</div>
                    </div>

                    {run.errorMessage && (
                      <div className="rounded-2xl border border-destructive/20 bg-background px-4 py-3 text-sm text-destructive">
                        {run.errorMessage}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 xl:min-w-44">
                    <ReleaseMigrationActions
                      projectId={run.projectId}
                      runId={run.id}
                      status={run.status}
                      imageUrl={run.imageUrl}
                    />
                    {run.releaseId ? (
                      <>
                        {run.primaryDomainUrl && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="justify-between rounded-xl"
                          >
                            <a href={run.primaryDomainUrl} target="_blank" rel="noreferrer">
                              打开环境
                              <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="justify-between rounded-xl"
                        >
                          <Link href={`/projects/${run.projectId}/releases/${run.releaseId}`}>
                            打开发布
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="justify-between rounded-xl"
                      >
                        <Link href={`/projects/${run.projectId}`}>
                          打开项目
                          <FolderKanban className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
