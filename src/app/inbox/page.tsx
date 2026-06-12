import { AlertTriangle, ArrowRight, Database, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MigrationSpecDetails } from '@/components/projects/MigrationSpecDetails';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { MetricTile, SectionLabel } from '@/components/ui/platform';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { formatApprovalStatusLabel } from '@/lib/approvals/view';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getInboxPageData } from '@/lib/inbox/service';
import { buildInboxFilterHref, normalizeInboxFilterState } from '@/lib/inbox/view';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
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
  const filterState = normalizeInboxFilterState(state);

  const memberships = await db.query.teamMembers.findMany({
    where: (member, { eq }) => eq(member.userId, session.user.id),
    with: {
      team: true,
    },
  });

  const teamIds = memberships.map((membership) => membership.teamId);
  const { stats, attentionRuns, schemaItems } = await getInboxPageData({
    teamIds,
    filterState,
    actorUserId: session.user.id,
  });
  const shellClassName = 'console-panel';
  const isEmpty = attentionRuns.length === 0 && schemaItems.length === 0;

  return (
    <PageShell size="wide">
      <PageHeader title="待处理" />

      <div className="grid gap-2 md:grid-cols-4">
        {stats.map((stat) => (
          <MetricTile key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className={`${shellClassName} px-4 py-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel className="mr-2">筛选</SectionLabel>
          <Button asChild variant={filterState === 'all' ? 'default' : 'outline'} size="sm">
            <Link href={buildInboxFilterHref('all')}>全部</Link>
          </Button>
          <Button asChild variant={filterState === 'approval' ? 'default' : 'outline'} size="sm">
            <Link href={buildInboxFilterHref('approval')}>迁移审批</Link>
          </Button>
          <Button asChild variant={filterState === 'failed' ? 'default' : 'outline'} size="sm">
            <Link href={buildInboxFilterHref('failed')}>失败迁移</Link>
          </Button>
          <Button asChild variant={filterState === 'schema' ? 'default' : 'outline'} size="sm">
            <Link href={buildInboxFilterHref('schema')}>数据库状态</Link>
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState icon={<AlertTriangle className="h-12 w-12" />} title="没有待处理事项" />
      ) : (
        <div className="space-y-5">
          {attentionRuns.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold text-foreground">迁移待办</div>
                <div className="text-xs text-muted-foreground">审批、外部完成和失败迁移</div>
              </div>

              {attentionRuns.map((run) => {
                const statusConfig = getMigrationStatusDecoration(run.status);

                return (
                  <div key={run.id} className={`${shellClassName} overflow-hidden`}>
                    <div className="flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusIndicator
                            status={statusConfig.color}
                            pulse={statusConfig.pulse}
                            label={formatApprovalStatusLabel(run.status)}
                          />
                          <span className="rounded-full bg-secondary/78 px-2.5 py-1 text-xs font-medium text-foreground">
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
                            {[
                              run.database.name,
                              run.database.type,
                              run.branchLabel,
                              run.createdAtLabel,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {run.platformSignals.primarySummary && (
                            <div className="text-sm text-foreground">
                              {run.platformSignals.primarySummary}
                            </div>
                          )}
                        </div>

                        {run.errorMessage && (
                          <div className="rounded-[18px] bg-destructive/[0.06] px-4 py-3 text-sm text-destructive shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
                            {run.errorMessage}
                          </div>
                        )}

                        <div className="mt-4">
                          <MigrationSpecDetails
                            specification={run.specification}
                            databaseType={run.database.type}
                            compact
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-stretch gap-2 xl:min-w-44">
                        <ReleaseMigrationActions
                          projectId={run.projectId}
                          runId={run.id}
                          status={run.status}
                          approvalToken={run.approvalToken ?? null}
                        />
                        {run.releaseId ? (
                          <>
                            {run.primaryDomainUrl && (
                              <Button
                                asChild
                                variant="secondary"
                                size="sm"
                                className="justify-between rounded-full px-4"
                              >
                                <a href={run.primaryDomainUrl} target="_blank" rel="noreferrer">
                                  环境
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button
                              asChild
                              variant="secondary"
                              size="sm"
                              className="justify-between rounded-full px-4"
                            >
                              <Link
                                href={buildReleaseDetailPath(
                                  run.projectId,
                                  run.environment.id,
                                  run.releaseId
                                )}
                              >
                                发布
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </>
                        ) : (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="justify-between rounded-full px-4"
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
            </section>
          )}

          {schemaItems.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold text-foreground">数据库状态</div>
                <div className="text-xs text-muted-foreground">待迁移、漂移、纳管和检查失败</div>
              </div>

              {schemaItems.map((item) => (
                <div key={item.id} className={`${shellClassName} overflow-hidden`}>
                  <div className="flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusIndicator status={item.statusColor} label={item.statusLabel} />
                        <span className="rounded-full bg-secondary/78 px-2.5 py-1 text-xs font-medium text-foreground">
                          {item.projectName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.environmentName}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="text-base font-semibold">
                          {item.databaseName} · {item.databaseType}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.meta}</div>
                        <div
                          className={
                            item.tone === 'danger'
                              ? 'text-sm text-destructive'
                              : 'text-sm text-foreground'
                          }
                        >
                          {item.summary}
                        </div>
                        {item.versionSummary && (
                          <div className="text-xs text-muted-foreground">{item.versionSummary}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 xl:min-w-44">
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="justify-between rounded-full px-4"
                      >
                        <Link href={item.href}>
                          {item.actionLabel}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="justify-between rounded-full px-4"
                      >
                        <Link href={`/projects/${item.projectId}`}>
                          项目
                          <FolderKanban className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
