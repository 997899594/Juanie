import { and, eq } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Database,
  GitBranch,
  GitCommit,
  Package2,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { DeploymentRollbackAction } from '@/components/projects/DeploymentRollbackAction';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  formatEnvironmentExpiry,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import { evaluateReleasePolicy } from '@/lib/policies/delivery';
import { getPreviousReleaseByScope, getReleaseById } from '@/lib/releases';
import { buildReleaseDiff } from '@/lib/releases/diff';
import { getReleaseIntelligenceSnapshot } from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';

const releaseStatusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean; label: string }
> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  planning: { color: 'info', pulse: true, label: '规划中' },
  migration_pre_running: { color: 'warning', pulse: true, label: '前置迁移' },
  migration_pre_failed: { color: 'error', pulse: false, label: '前置迁移失败' },
  deploying: { color: 'info', pulse: true, label: '发布中' },
  verifying: { color: 'info', pulse: true, label: '校验中' },
  migration_post_running: { color: 'warning', pulse: true, label: '后置迁移' },
  degraded: { color: 'warning', pulse: false, label: '降级' },
  succeeded: { color: 'success', pulse: false, label: '成功' },
  failed: { color: 'error', pulse: false, label: '失败' },
  canceled: { color: 'neutral', pulse: false, label: '已取消' },
};

const deploymentStatusConfig: Record<
  string,
  { color: 'success' | 'warning' | 'error' | 'info' | 'neutral'; pulse: boolean; label: string }
> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  building: { color: 'info', pulse: true, label: '构建中' },
  deploying: { color: 'info', pulse: true, label: '发布中' },
  running: { color: 'success', pulse: false, label: '运行中' },
  failed: { color: 'error', pulse: false, label: '失败' },
  rolled_back: { color: 'warning', pulse: false, label: '已回滚' },
};

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

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; releaseId: string }>;
}) {
  const { id, releaseId } = await params;

  const releaseHeader = await db.query.releases.findFirst({
    where: and(eq(releases.id, releaseId), eq(releases.projectId, id)),
  });

  if (!releaseHeader) {
    notFound();
  }

  const release = await getReleaseById(releaseId);
  if (!release || release.projectId !== id) {
    notFound();
  }

  const previousRelease = await getPreviousReleaseByScope({
    projectId: id,
    environmentId: release.environmentId,
    createdAt: release.createdAt,
  });

  const releaseConfig = releaseStatusConfig[release.status] || releaseStatusConfig.queued;
  const approvalRuns = release.migrationRuns.filter((run) => run.status === 'awaiting_approval');
  const failedRuns = release.migrationRuns.filter((run) =>
    ['failed', 'canceled'].includes(run.status)
  );
  const intelligence = getReleaseIntelligenceSnapshot(release);
  const policy = evaluateReleasePolicy(release);
  const riskLabel =
    intelligence.riskLevel === 'high'
      ? '高风险'
      : intelligence.riskLevel === 'medium'
        ? '中风险'
        : '低风险';
  const environmentScope = getEnvironmentScopeLabel(release.environment ?? {});
  const environmentSource = getEnvironmentSourceLabel(release.environment ?? {});
  const environmentExpiry = formatEnvironmentExpiry(release.environment?.expiresAt);
  const primaryDomain = pickPrimaryEnvironmentDomain(release.environment?.domains ?? []);
  const releaseDiff = buildReleaseDiff(release, previousRelease ?? null);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={getReleaseDisplayTitle(release)}
        description={release.sourceRef}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {primaryDomain && (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
                <a
                  href={buildEnvironmentAccessUrl(primaryDomain.hostname)}
                  target="_blank"
                  rel="noreferrer"
                >
                  打开环境
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4">
              <Link href={`/projects/${id}/releases`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                返回
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="console-panel px-5 py-4">
          <div className="mb-2">
            <StatusIndicator
              status={releaseConfig.color}
              pulse={releaseConfig.pulse}
              label={releaseConfig.label}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{release.environment?.name ?? '环境'}</span>
            {environmentScope && <Badge variant="outline">{environmentScope}</Badge>}
            {environmentSource && <Badge variant="outline">{environmentSource}</Badge>}
            {environmentExpiry && <Badge variant="outline">{environmentExpiry}</Badge>}
            <Badge variant="outline">{riskLabel}</Badge>
          </div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            服务
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">
            {release.artifacts.length}
          </div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            部署
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">
            {release.deployments.length}
          </div>
        </div>
        <div className="console-panel px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            迁移
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">
            {release.migrationRuns.length}
          </div>
        </div>
      </div>

      <div className="console-panel px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {release.sourceCommitSha && (
            <div className="flex items-center gap-1.5">
              <GitCommit className="h-3.5 w-3.5" />
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {release.sourceCommitSha.slice(0, 7)}
              </code>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{release.sourceRef}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{new Date(release.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            <span>{release.sourceRepository}</span>
          </div>
        </div>
        {(intelligence.failureSummary ||
          policy.summary ||
          intelligence.reasons.length > 0 ||
          policy.reasons.length > 0 ||
          intelligence.actionLabel) && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {intelligence.failureSummary && (
              <span className="rounded-full border border-destructive/15 bg-background px-2.5 py-1 text-destructive">
                {intelligence.failureSummary}
              </span>
            )}
            {intelligence.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-border bg-secondary/30 px-2.5 py-1 text-foreground"
              >
                {reason}
              </span>
            ))}
            {policy.summary && (
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                {policy.summary}
              </span>
            )}
            {intelligence.actionLabel && (
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                下一步：{intelligence.actionLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <section className="console-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">变更</div>
          {previousRelease ? (
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
              <Link href={`/projects/${id}/releases/${previousRelease.id}`}>
                对比上一版：{getReleaseDisplayTitle(previousRelease)}
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
            {releaseDiff.changedArtifacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                当前没有镜像变化。
              </div>
            ) : (
              releaseDiff.changedArtifacts.map((item) => (
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
            {releaseDiff.changedMigrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                当前没有迁移计划变化。
              </div>
            ) : (
              releaseDiff.changedMigrations.map((item) => (
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

      {(approvalRuns.length > 0 || failedRuns.length > 0 || release.errorMessage) && (
        <div className="rounded-2xl border border-border bg-secondary/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-background p-2 text-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">需要处理</div>
              <div className="text-sm text-muted-foreground">
                {approvalRuns.length > 0 && <span>{approvalRuns.length} 个待审批。 </span>}
                {failedRuns.length > 0 && <span>{failedRuns.length} 个可重试。 </span>}
                {release.errorMessage && <span>{release.errorMessage}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section className="console-panel p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Package2 className="h-4 w-4" />
              镜像
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {release.artifacts.map((artifact) => (
                <div key={artifact.id} className="console-card bg-secondary/20 px-4 py-3">
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
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Rocket className="h-4 w-4" />
              部署进度
            </div>
            {release.deployments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
                当前发布还没有部署记录。
              </div>
            ) : (
              <div className="space-y-3">
                {release.deployments.map((deployment) => {
                  const deploymentConfig =
                    deploymentStatusConfig[deployment.status] || deploymentStatusConfig.queued;

                  return (
                    <div key={deployment.id} className="console-card bg-secondary/20 px-4 py-3">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <StatusIndicator
                          status={deploymentConfig.color}
                          pulse={deploymentConfig.pulse}
                          label={deploymentConfig.label}
                        />
                        <Badge variant="outline">
                          {deployment.serviceId
                            ? (release.artifacts.find(
                                (artifact) => artifact.serviceId === deployment.serviceId
                              )?.service.name ?? 'service')
                            : '项目'}
                        </Badge>
                        {deployment.version && (
                          <Badge variant="secondary">v{deployment.version}</Badge>
                        )}
                      </div>
                      {deployment.imageUrl && (
                        <div className="mb-3 break-all text-xs text-muted-foreground">
                          {deployment.imageUrl}
                        </div>
                      )}
                      <div className="mb-3">
                        <DeploymentRollbackAction projectId={id} deploymentId={deployment.id} />
                      </div>
                      <DeploymentLogs
                        projectId={id}
                        deploymentId={deployment.id}
                        status={deployment.status}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="console-panel p-5">
            <div className="mb-4 text-sm font-semibold">迁移记录</div>
            {release.migrationRuns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
                没有自动迁移记录。
              </div>
            ) : (
              <div className="space-y-3">
                {release.migrationRuns.map((run) => {
                  const migrationConfig =
                    migrationStatusConfig[run.status] || migrationStatusConfig.queued;
                  const runImageUrl =
                    release.artifacts.find((artifact) => artifact.serviceId === run.serviceId)
                      ?.imageUrl ?? null;

                  return (
                    <div key={run.id} className="console-card bg-secondary/20 px-4 py-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusIndicator
                            status={migrationConfig.color}
                            pulse={migrationConfig.pulse}
                            label={formatStatusLabel(run.status)}
                          />
                          <Badge variant="outline">{run.specification.phase}</Badge>
                          <Badge variant="secondary">{run.database.name}</Badge>
                        </div>
                        <ReleaseMigrationActions
                          projectId={id}
                          runId={run.id}
                          status={run.status}
                          imageUrl={runImageUrl}
                        />
                      </div>
                      <div className="text-sm font-medium">
                        {run.service?.name ?? '服务'} · {run.specification.tool}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.specification.command}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="console-panel p-5">
            <div className="mb-4 text-sm font-semibold">元数据</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">配置提交</span>
                <span>{release.configCommitSha?.slice(0, 7) ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">更新时间</span>
                <span>{new Date(release.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">发布 ID</span>
                <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{release.id}</code>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
