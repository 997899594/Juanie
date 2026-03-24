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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
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

function formatStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    queued: '排队中',
    awaiting_approval: '待审批',
    planning: '规划中',
    running: '执行中',
    success: '成功',
    failed: '失败',
    canceled: '已取消',
    skipped: '已跳过',
  };
  return labels[value] ?? value;
}

function buildFilterHref(state: string): string {
  return state === 'all' ? '/approvals' : `/approvals?state=${state}`;
}

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
  const filterState =
    state === 'approval' || state === 'failed' || state === 'canceled' ? state : 'all';

  const memberships = await db.query.teamMembers.findMany({
    where: (member, { eq }) => eq(member.userId, session.user.id),
    with: {
      team: true,
    },
  });

  const teamIds = memberships.map((membership) => membership.teamId);
  const visibleProjects =
    teamIds.length > 0
      ? await db.query.projects.findMany({
          where: (project, { inArray }) => inArray(project.teamId, teamIds),
          columns: {
            id: true,
          },
        })
      : [];
  const projectIds = visibleProjects.map((project) => project.id);

  const runs =
    projectIds.length > 0
      ? await db.query.migrationRuns.findMany({
          where: (run, { inArray }) => inArray(run.projectId, projectIds),
          orderBy: (run, { desc }) => [desc(run.createdAt)],
          with: {
            database: true,
            environment: true,
            service: true,
            project: true,
            specification: true,
            release: {
              with: {
                artifacts: true,
              },
            },
          },
        })
      : [];

  const attentionRuns = runs.filter((run) =>
    ['awaiting_approval', 'failed', 'canceled'].includes(run.status)
  );
  const filteredRuns = attentionRuns.filter((run) => {
    if (filterState === 'all') return true;
    if (filterState === 'approval') return run.status === 'awaiting_approval';
    if (filterState === 'failed') return run.status === 'failed';
    if (filterState === 'canceled') return run.status === 'canceled';
    return true;
  });

  const stats = [
    { label: '待处理', value: attentionRuns.length },
    {
      label: '待审批',
      value: attentionRuns.filter((run) => run.status === 'awaiting_approval').length,
    },
    { label: '失败', value: attentionRuns.filter((run) => run.status === 'failed').length },
    { label: '已取消', value: attentionRuns.filter((run) => run.status === 'canceled').length },
  ];

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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={filterState === 'all' ? 'default' : 'outline'} size="sm">
            <Link href={buildFilterHref('all')}>全部</Link>
          </Button>
          <Button asChild variant={filterState === 'approval' ? 'default' : 'outline'} size="sm">
            <Link href={buildFilterHref('approval')}>待审批</Link>
          </Button>
          <Button asChild variant={filterState === 'failed' ? 'default' : 'outline'} size="sm">
            <Link href={buildFilterHref('failed')}>失败</Link>
          </Button>
          <Button asChild variant={filterState === 'canceled' ? 'default' : 'outline'} size="sm">
            <Link href={buildFilterHref('canceled')}>已取消</Link>
          </Button>
        </div>
      </div>

      {filteredRuns.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12" />}
          title="没有待处理迁移"
          description="当前筛选条件下为空。"
        />
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run) => {
            const statusConfig = migrationStatusConfig[run.status] || migrationStatusConfig.queued;
            const imageUrl =
              run.release?.artifacts.find((artifact) => artifact.serviceId === run.serviceId)
                ?.imageUrl ?? null;

            return (
              <div key={run.id} className="console-panel overflow-hidden">
                <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={statusConfig.color}
                        pulse={statusConfig.pulse}
                        label={formatStatusLabel(run.status)}
                      />
                      <Badge variant="secondary">{run.project.name}</Badge>
                      <Badge variant="outline">{run.environment.name}</Badge>
                      <Badge variant="outline">{run.database.name}</Badge>
                      <Badge variant="outline">{run.specification.phase}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="text-base font-semibold">
                        {run.service?.name ?? 'service'} · {run.specification.tool}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{new Date(run.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Database className="h-3.5 w-3.5" />
                          <span>{run.database.type}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5" />
                          <span>{run.environment.branch ?? '未设置'}</span>
                        </div>
                      </div>
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
                      imageUrl={imageUrl}
                    />
                    {run.releaseId ? (
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
