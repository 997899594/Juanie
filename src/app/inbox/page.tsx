import { AlertTriangle, ArrowRight, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PriorityDeck, type PriorityDeckItem } from '@/components/ui/priority-deck';
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
  const firstRun = attentionRuns[0] ?? null;
  const priorityItems: PriorityDeckItem[] = [];

  if (firstRun) {
    priorityItems.push({
      key: 'primary',
      eyebrow: '先处理这个',
      title: firstRun.issueLabel ?? `${firstRun.project.name} · ${firstRun.database.name}`,
      description: firstRun.platformSignals.primarySummary ?? firstRun.environment.name,
      href: firstRun.releaseId
        ? `/projects/${firstRun.projectId}/delivery/${firstRun.releaseId}`
        : `/projects/${firstRun.projectId}`,
      actionLabel: firstRun.platformSignals.nextActionLabel ?? '进入处理',
      tone:
        firstRun.status === 'failed'
          ? 'danger'
          : firstRun.status === 'awaiting_approval'
            ? 'warning'
            : 'default',
    });
  }

  priorityItems.push(
    {
      key: 'approval',
      eyebrow: '按类型收敛',
      title: filterState === 'all' ? '先筛出一种阻塞类型' : `当前筛选：${filterState}`,
      description: '减少干扰。',
      href:
        filterState === 'approval'
          ? buildApprovalsFilterHref('external')
          : buildApprovalsFilterHref('approval'),
      actionLabel: filterState === 'approval' ? '切到外部动作' : '只看待审批',
      tone: 'default',
    },
    {
      key: 'return',
      eyebrow: '处理完以后',
      title: '回到项目继续推进主链',
      description: '回项目继续。',
      href: firstRun ? `/projects/${firstRun.projectId}` : '/projects',
      actionLabel: firstRun ? '打开对应项目' : '打开项目列表',
      tone: 'success',
    }
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="行动中心"
        description="把所有需要你立即推进的审批、外部动作和失败项收拢到一个地方。"
        eyebrow="Action Center"
        meta="不知道先去哪，就先来这里。"
      />

      <PriorityDeck title="行动顺序" description="先解阻塞。" items={priorityItems} />

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
            <Link href={buildApprovalsFilterHref('all')}>全部</Link>
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
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12" />}
          title="没有待处理事项"
          description="当前筛选条件下为空。"
        />
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
                      <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
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
                          下一步：{run.platformSignals.nextActionLabel}
                        </div>
                      )}
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
                          <Link href={`/projects/${run.projectId}/delivery/${run.releaseId}`}>
                            打开交付
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
