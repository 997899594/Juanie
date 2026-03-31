import { and, eq } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Database,
  Dot,
  GitBranch,
  GitCommit,
  Package2,
  Rocket,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { DeploymentRollbackAction } from '@/components/projects/DeploymentRollbackAction';
import { DeploymentRolloutAction } from '@/components/projects/DeploymentRolloutAction';
import { ReleaseAISnapshotPanel } from '@/components/projects/ReleaseAISnapshotPanel';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PlatformSignalSummary } from '@/components/ui/platform-signals';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { resolveAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { buildReleaseEnvironmentActionSnapshot } from '@/lib/releases/governance-view';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseDetailPageData } from '@/lib/releases/service';
import { formatPlatformDateTime } from '@/lib/time/format';

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; releaseId: string }>;
}) {
  const { id, releaseId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    notFound();
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) {
    redirect('/projects');
  }

  const pageData = await getReleaseDetailPageData({ projectId: id, releaseId });
  if (!pageData) {
    notFound();
  }
  const { release, previousReleaseLink } = pageData;
  const [releasePlanSnapshot, incidentSnapshot] = await Promise.all([
    resolveAIPluginSnapshot<ReleasePlan>({
      pluginId: 'release-intelligence',
      context: {
        teamId: project.teamId,
        projectId: id,
        environmentId: release.environment?.id ?? release.environmentId,
        releaseId,
        actorUserId: session.user.id,
      },
    }),
    resolveAIPluginSnapshot<IncidentAnalysis>({
      pluginId: 'incident-intelligence',
      context: {
        teamId: project.teamId,
        projectId: id,
        environmentId: release.environment?.id ?? release.environmentId,
        releaseId,
        actorUserId: session.user.id,
      },
    }),
  ]);
  const releaseActions = buildReleaseEnvironmentActionSnapshot(member.role, release.environment);
  const environmentId = release.environment?.id ?? release.environmentId;
  const environmentLogsHref = `/projects/${id}/logs?env=${environmentId}`;
  const environmentDetailHref = `/projects/${id}/environments?env=${environmentId}`;
  const environmentDiagnosticsHref = `/projects/${id}/environments?env=${environmentId}&panel=diagnostics`;
  const releasesHref = `/projects/${id}/releases`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={getReleaseDisplayTitle(release)}
        description={release.sourceRef}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="h-9 rounded-xl px-4">
              <Link href={environmentLogsHref}>
                <ScrollText className="h-3.5 w-3.5" />
                查看日志
              </Link>
            </Button>
            {release.primaryDomainUrl && (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
                <a href={release.primaryDomainUrl} target="_blank" rel="noreferrer">
                  打开环境
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href={releasesHref}>
                <ArrowLeft className="h-3.5 w-3.5" />
                返回
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="console-panel px-5 py-4">
          <div className="mb-2">
            <StatusIndicator
              status={release.statusDecoration.color}
              pulse={release.statusDecoration.pulse}
              label={release.statusDecoration.label}
            />
          </div>
          <div className="text-sm font-medium">{release.environment?.name ?? '环境'}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {[
              release.environmentScope,
              release.environmentSource,
              release.previewSourceMeta.label,
              release.environmentExpiry,
              release.riskLabel,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        {release.stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="console-panel px-5 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {release.sourceCommitSha && (
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitCommit className="h-3.5 w-3.5" />
                提交
              </div>
              <code className="mt-2 inline-flex rounded bg-background px-2 py-1 text-xs font-mono">
                {release.sourceCommitSha.slice(0, 7)}
              </code>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              来源分支
            </div>
            <div className="mt-2 text-sm font-medium">{release.sourceRef}</div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              创建时间
            </div>
            <div className="mt-2 text-sm font-medium">
              {formatPlatformDateTime(release.createdAt) ?? '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              仓库来源
            </div>
            <div className="mt-2 text-sm font-medium">{release.sourceRepository}</div>
          </div>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          {[
            release.environmentStrategy,
            release.environmentDatabaseStrategy,
            release.environmentInheritance,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <PlatformSignalSummary
          summary={release.platformSignals.primarySummary}
          nextActionLabel={release.platformSignals.nextActionLabel}
          className="mt-4"
        />
      </div>

      <ReleaseAISnapshotPanel
        projectId={id}
        releaseId={releaseId}
        releasePlan={releasePlanSnapshot}
        incidentAnalysis={incidentSnapshot}
      />

      <section className="grid gap-4 xl:grid-cols-[0.78fr_1fr_0.8fr]">
        <div className="console-panel p-5">
          <div className="mb-4 text-sm font-semibold">阻塞原因与总结</div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                阻塞原因
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {release.blockingReason?.label ?? '当前没有明显阻塞'}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {release.blockingReason?.summary ??
                  '发布链路没有发现明显的迁移、调度、镜像或运行时异常。'}
              </div>
              {release.blockingReason?.nextActionLabel && (
                <div className="mt-2 text-xs text-muted-foreground">
                  下一步：{release.blockingReason.nextActionLabel}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                这次发了什么
              </div>
              <div className="mt-2 text-sm text-foreground">{release.narrativeSummary.changed}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                风险点
              </div>
              <div className="mt-2 text-sm text-foreground">{release.narrativeSummary.risk}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                当前结果
              </div>
              <div className="mt-2 text-sm text-foreground">{release.narrativeSummary.result}</div>
            </div>
            {release.narrativeSummary.governance && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  平台处理
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {release.narrativeSummary.governance}
                </div>
              </div>
            )}
            {release.narrativeSummary.nextAction && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  下一步建议
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {release.narrativeSummary.nextAction}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="console-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">发布时间线</div>
              <div className="mt-1 text-xs text-muted-foreground">
                把 release、迁移、部署、放量和基础设施异常串成一条线。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href={environmentLogsHref}>环境日志</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href={environmentDiagnosticsHref}>环境诊断</Link>
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {release.timeline.map((item, index) => (
              <div key={item.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      item.tone === 'danger'
                        ? 'text-destructive'
                        : item.tone === 'warning'
                          ? 'text-warning'
                          : item.tone === 'success'
                            ? 'text-success'
                            : item.tone === 'info'
                              ? 'text-info'
                              : 'text-muted-foreground'
                    }
                  >
                    <Dot className="h-5 w-5" />
                  </div>
                  {index < release.timeline.length - 1 && (
                    <div className="mt-1 h-full w-px bg-border" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.at && <div className="text-xs text-muted-foreground">{item.at}</div>}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                  {item.href && (
                    <div className="mt-2">
                      {item.href.startsWith('http') ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-foreground underline underline-offset-4"
                        >
                          打开
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="text-xs text-foreground underline underline-offset-4"
                        >
                          打开
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="console-panel p-5">
          <div className="mb-4 text-sm font-semibold">观察与入口</div>
          <div className="space-y-4">
            {release.infrastructureDiagnostics && (
              <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  容量与治理
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  剩余 {release.infrastructureDiagnostics.capacity.availableMemoryLabel}
                  {release.infrastructureDiagnostics.capacity.saturationLabel
                    ? ` · 使用率 ${release.infrastructureDiagnostics.capacity.saturationLabel}`
                    : ''}
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div>
                    集群已请求 {release.infrastructureDiagnostics.capacity.requestedMemoryLabel} /
                    可分配 {release.infrastructureDiagnostics.capacity.allocatableMemoryLabel}
                  </div>
                  <div>
                    平台占用{' '}
                    {release.infrastructureDiagnostics.capacity.platformRequestedMemoryLabel}
                    ，当前环境占用{' '}
                    {release.infrastructureDiagnostics.capacity.environmentRequestedMemoryLabel}
                  </div>
                  <div>
                    这次放量预估增量{' '}
                    {release.infrastructureDiagnostics.capacity.estimatedRolloutDeltaMemoryLabel}
                  </div>
                  <div>
                    {
                      release.infrastructureDiagnostics.abnormalResources.clusterTerminatingPods
                        .label
                    }
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                主要入口
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {release.environment?.name ?? '环境'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                先看日志，再结合时间线判断是迁移、部署还是放量阶段出问题。
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-xl">
                  <Link href={environmentLogsHref}>打开环境日志</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link href={environmentDetailHref}>查看环境</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                排障顺序
              </div>
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <div>1. 看发布时间线，确认卡在哪一步。</div>
                <div>2. 进环境日志，看运行时真实输出。</div>
                <div>3. 只有需要 Pod/Service 细节时，再展开环境里的资源诊断。</div>
              </div>
              <div className="mt-3">
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link href={releasesHref}>回到发布中心</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">变更</div>
          {previousReleaseLink ? (
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
              <Link href={`/projects/${id}/releases/${previousReleaseLink.id}`}>
                对比上一版：{previousReleaseLink.title}
              </Link>
            </Button>
          ) : (
            <Badge variant="outline">首次发布</Badge>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              镜像变化
            </div>
            {release.diff.changedArtifacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                当前没有镜像变化。
              </div>
            ) : (
              release.diff.changedArtifacts.map((item) => (
                <div
                  key={`${item.serviceId}:${item.change}`}
                  className="console-card bg-secondary/20 px-4 py-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{item.serviceName}</div>
                    <Badge variant="secondary">
                      {item.change === 'added'
                        ? '新增'
                        : item.change === 'updated'
                          ? '更新'
                          : '移除'}
                    </Badge>
                  </div>
                  {item.previousImageUrl && (
                    <div className="text-xs text-muted-foreground">
                      之前：{item.previousImageUrl}
                    </div>
                  )}
                  {item.currentImageUrl && (
                    <div className="mt-1 text-xs text-foreground">当前：{item.currentImageUrl}</div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              迁移变化
            </div>
            {release.diff.changedMigrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                当前没有迁移计划变化。
              </div>
            ) : (
              release.diff.changedMigrations.map((item) => (
                <div key={item.key} className="console-card bg-secondary/20 px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{item.label}</div>
                    <Badge variant="secondary">{item.change === 'added' ? '新增' : '移除'}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.tool} · {item.phase}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {(release.approvalRunsCount > 0 ||
        release.retryableRunsCount > 0 ||
        release.errorMessage) && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-background p-2 text-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">需要处理</div>
              <div className="text-sm text-muted-foreground">
                {release.intelligence.issue?.summary && (
                  <span>{release.intelligence.issue.summary}。 </span>
                )}
                {release.approvalRunsCount > 0 && (
                  <span>{release.approvalRunsCount} 个待审批。 </span>
                )}
                {release.retryableRunsCount > 0 && (
                  <span>{release.retryableRunsCount} 个可重试。 </span>
                )}
                {release.intelligence.issue?.nextActionLabel && (
                  <span>下一步：{release.intelligence.issue.nextActionLabel}。 </span>
                )}
                {release.errorMessage && <span>{release.errorMessage}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {release.environment?.deploymentStrategy &&
            release.environment.deploymentStrategy !== 'rolling' &&
            release.deploymentItems.length > 0 && (
              <section className="console-panel p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <Rocket className="h-4 w-4" />
                  Rollout
                </div>
                <div className="mb-4 text-sm text-muted-foreground">
                  当前环境使用 {release.environmentStrategy ?? '渐进式发布'}
                  。候选版本准备好后，在这里完成放量或切换。
                </div>
                <div className="space-y-3">
                  {release.deploymentItems.map((deployment) => (
                    <div
                      key={`rollout-${deployment.id}`}
                      className="console-card bg-secondary/20 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{deployment.serviceName}</div>
                          {deployment.imageUrl && (
                            <div className="mt-1 break-all text-xs text-muted-foreground">
                              {deployment.imageUrl}
                            </div>
                          )}
                        </div>
                        <DeploymentRolloutAction
                          projectId={id}
                          deploymentId={deployment.id}
                          strategyLabel={release.environmentStrategy}
                          disabled={!releaseActions.canManage}
                          disabledSummary={releaseActions.summary}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          <section className="console-panel p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Package2 className="h-4 w-4" />
              镜像
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {release.artifacts.map((artifact) => (
                <div
                  key={artifact.id ?? artifact.service.id}
                  className="console-card bg-secondary/20 px-4 py-3"
                >
                  <div className="mb-1 text-sm font-medium">{artifact.service.name}</div>
                  <div className="break-all text-xs text-muted-foreground">{artifact.imageUrl}</div>
                  {artifact.imageDigest && (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      摘要 {artifact.imageDigest}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="console-panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Rocket className="h-4 w-4" />
                部署进度
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
                <Link href={environmentLogsHref}>查看环境日志</Link>
              </Button>
            </div>
            {release.deployments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
                当前发布还没有部署记录。
              </div>
            ) : (
              <div className="space-y-3">
                {release.deploymentItems.map((deployment) => (
                  <div key={deployment.id} className="console-card bg-secondary/20 px-4 py-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={deployment.statusDecoration.color}
                        pulse={deployment.statusDecoration.pulse}
                        label={deployment.statusDecoration.label}
                      />
                      <Badge variant="outline">{deployment.serviceName}</Badge>
                      {deployment.version && (
                        <Badge variant="secondary">v{deployment.version}</Badge>
                      )}
                    </div>
                    {deployment.imageUrl && (
                      <div className="mb-3 break-all text-xs text-muted-foreground">
                        {deployment.imageUrl}
                      </div>
                    )}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <DeploymentRollbackAction
                        projectId={id}
                        deploymentId={deployment.id}
                        disabled={!releaseActions.canManage}
                        disabledSummary={releaseActions.summary}
                      />
                    </div>
                    <DeploymentLogs
                      projectId={id}
                      deploymentId={deployment.id}
                      status={deployment.status}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="console-panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">迁移记录</div>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
                <Link href={environmentLogsHref}>查看环境日志</Link>
              </Button>
            </div>
            {release.migrationRuns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
                没有自动迁移记录。
              </div>
            ) : (
              <div className="space-y-3">
                {release.migrationItems.map((run) => (
                  <div key={run.id} className="console-card bg-secondary/20 px-4 py-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusIndicator
                          status={run.statusDecoration.color}
                          pulse={run.statusDecoration.pulse}
                          label={run.statusDecoration.label}
                        />
                        <Badge variant="outline">{run.specification.phase}</Badge>
                        <Badge variant="secondary">{run.database.name}</Badge>
                      </div>
                      <ReleaseMigrationActions
                        projectId={id}
                        runId={run.id}
                        status={run.status}
                        imageUrl={run.imageUrl}
                        disabled={!releaseActions.canManage}
                        disabledSummary={releaseActions.summary}
                      />
                    </div>
                    <div className="text-sm font-medium">
                      {run.serviceName} · {run.specification.tool}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {run.specification.command}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="console-panel p-5">
            <div className="mb-4 text-sm font-semibold">元数据</div>
            <div className="space-y-3 text-sm">
              {release.metadataItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{item.label}</span>
                  {item.mono ? (
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                      {item.value}
                    </code>
                  ) : (
                    <span>{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
        <div className="flex items-center gap-2 rounded-[24px] border border-border bg-background/95 p-2 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button asChild size="sm" className="min-w-0 flex-1 rounded-xl">
            <Link href={environmentLogsHref}>日志</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl">
            <Link href={environmentDetailHref}>环境</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl">
            <Link href={releasesHref}>发布中心</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
