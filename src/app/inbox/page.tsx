import { AlertTriangle, ArrowRight, FolderKanban } from 'lucide-react';
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
import { getMigrationStatusDecoration } from '@/lib/releases/status-presentation';

export default async function InboxPage({
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
      <PageHeader title="待处理" />

      <div className="console-surface rounded-[20px] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {stats.map((stat) => (
            <span key={stat.label}>
              {stat.label} {stat.value}
            </span>
          ))}
        </div>
      </div>

      <div className="console-panel px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            筛选
          </div>
          <Button asChild variant={filterState === 'all' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('all')}>待处理</Link>
          </Button>
          <Button asChild variant={filterState === 'approval' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('approval')}>待审批</Link>
          </Button>
          <Button asChild variant={filterState === 'external' ? 'default' : 'outline'} size="sm">
            <Link href={buildApprovalsFilterHref('external')}>待外部完成</Link>
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
        <EmptyState icon={<AlertTriangle className="h-12 w-12" />} title="没有待处理事项" />
      ) : (
        <div className="space-y-3">
          {attentionRuns.map((run) => {
            const statusConfig = getMigrationStatusDecoration(run.status);

            return (
              <div key={run.id} className="console-panel overflow-hidden">
                <div className="flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={statusConfig.color}
                        pulse={statusConfig.pulse}
                        label={formatApprovalStatusLabel(run.status)}
                      />
                      <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.03)]">
                        {run.project.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {run.environment.name}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="text-base font-semibold">
                        {run.service?.name ?? 'service'} · {run.specification.tool}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[run.database.name, run.database.type, run.branchLabel, run.createdAtLabel]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {run.platformSignals.primarySummary && (
                        <div className="text-sm text-foreground">
                          {run.platformSignals.primarySummary}
                        </div>
                      )}
                      {run.platformSignals.nextActionLabel && (
                        <div className="text-xs text-muted-foreground">
                          {run.platformSignals.nextActionLabel}
                        </div>
                      )}
                    </div>

                    {run.errorMessage && (
                      <div className="rounded-2xl bg-destructive/[0.06] px-4 py-3 text-sm text-destructive shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
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
                              环境
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
                          <Link href={`/projects/${run.projectId}/delivery/${run.releaseId}`}>
                            交付
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
                          项目
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
