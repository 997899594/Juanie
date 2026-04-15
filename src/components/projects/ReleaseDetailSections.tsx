import { Clock3, Dot, GitBranch, Package2, Rocket } from 'lucide-react';
import Link from 'next/link';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { DeploymentRollbackAction } from '@/components/projects/DeploymentRollbackAction';
import { DeploymentRolloutAction } from '@/components/projects/DeploymentRolloutAction';
import { MigrationSpecDetails } from '@/components/projects/MigrationSpecDetails';
import { ReleaseAISnapshotPanel } from '@/components/projects/ReleaseAISnapshotPanel';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlatformSignalSummary } from '@/components/ui/platform-signals';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { TeamRole } from '@/lib/db/schema';
import { getMigrationPhaseLabel } from '@/lib/migrations/presentation';
import { buildReleaseEnvironmentActionSnapshot } from '@/lib/releases/governance-view';
import type { getReleaseDetailPageData } from '@/lib/releases/service';
import { formatPlatformDateTime } from '@/lib/time/format';

type ReleasePageData = NonNullable<Awaited<ReturnType<typeof getReleaseDetailPageData>>>;

function getToneClass(tone: ReleasePageData['release']['timeline'][number]['tone']) {
  if (tone === 'danger') return 'text-destructive';
  if (tone === 'warning') return 'text-warning';
  if (tone === 'success') return 'text-success';
  if (tone === 'info') return 'text-info';
  return 'text-muted-foreground';
}

function formatArtifactReference(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value.split('/').pop() ?? value;
  return compact.length > 44 ? `${compact.slice(0, 41)}...` : compact;
}

export function ReleaseTopSummarySection({ release }: { release: ReleasePageData['release'] }) {
  return (
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
          {[release.environmentScope, release.environmentSource, release.previewSourceMeta.label]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {(release.platformSignals.primarySummary || release.platformSignals.nextActionLabel) && (
          <PlatformSignalSummary
            summary={release.platformSignals.primarySummary}
            nextActionLabel={release.platformSignals.nextActionLabel}
            className="mt-4"
          />
        )}
      </div>
      {release.stats.map((stat) => (
        <div key={stat.label} className="console-panel px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {stat.label}
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ReleaseNarrativeSection({
  release,
  environmentLogsHref,
  environmentDetailHref,
  releasesHref,
}: {
  release: ReleasePageData['release'];
  environmentLogsHref: string;
  environmentDetailHref: string;
  releasesHref: string;
}) {
  return (
    <div className="console-panel p-5">
      <div className="mb-4 text-sm font-semibold">摘要</div>
      <div className="space-y-4">
        <div className="console-card rounded-2xl px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            阻塞
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {release.blockingReason?.label ?? '无'}
          </div>
          {release.blockingReason?.nextActionLabel && (
            <div className="mt-2 text-xs text-muted-foreground">
              {release.blockingReason.nextActionLabel}
            </div>
          )}
        </div>
        {release.infrastructureDiagnostics && (
          <div className="console-surface rounded-2xl px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              容量
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              剩余 {release.infrastructureDiagnostics.capacity.availableMemoryLabel}
              {release.infrastructureDiagnostics.capacity.saturationLabel
                ? ` · 使用率 ${release.infrastructureDiagnostics.capacity.saturationLabel}`
                : ''}
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div>
                已请求 {release.infrastructureDiagnostics.capacity.requestedMemoryLabel} / 可分配{' '}
                {release.infrastructureDiagnostics.capacity.allocatableMemoryLabel}
              </div>
              <div>
                平台 {release.infrastructureDiagnostics.capacity.platformRequestedMemoryLabel} ·
                环境 {release.infrastructureDiagnostics.capacity.environmentRequestedMemoryLabel}
              </div>
              <div>
                本次增量{' '}
                {release.infrastructureDiagnostics.capacity.estimatedRolloutDeltaMemoryLabel}
              </div>
              <div>
                {release.infrastructureDiagnostics.abnormalResources.clusterTerminatingPods.label}
              </div>
            </div>
          </div>
        )}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            变更
          </div>
          <div className="mt-2 text-sm text-foreground">{release.narrativeSummary.changed}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            风险
          </div>
          <div className="mt-2 text-sm text-foreground">{release.narrativeSummary.risk}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            结果
          </div>
          <div className="mt-2 text-sm text-foreground">{release.narrativeSummary.result}</div>
        </div>
        {release.narrativeSummary.governance && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              处理
            </div>
            <div className="mt-2 text-sm text-foreground">
              {release.narrativeSummary.governance}
            </div>
          </div>
        )}
        {release.narrativeSummary.nextAction && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              动作
            </div>
            <div className="mt-2 text-sm text-foreground">
              {release.narrativeSummary.nextAction}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" className="rounded-xl">
            <Link href={environmentLogsHref}>日志</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={environmentDetailHref}>环境</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={releasesHref}>返回</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReleaseTimelineSection({
  release,
  environmentLogsHref,
  environmentDiagnosticsHref,
}: {
  release: ReleasePageData['release'];
  environmentLogsHref: string;
  environmentDiagnosticsHref: string;
}) {
  return (
    <div className="console-panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold">时间线</div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={environmentLogsHref}>日志</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={environmentDiagnosticsHref}>诊断</Link>
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {release.timeline.map((item, index) => (
          <div key={item.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={getToneClass(item.tone)}>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReleaseDiffSection({
  projectId,
  previousReleaseLink,
  release,
}: {
  projectId: string;
  previousReleaseLink: ReleasePageData['previousReleaseLink'];
  release: ReleasePageData['release'];
}) {
  const runtimeMigrationDiffItems = release.migrationItems
    .filter(
      (run) =>
        run.specification.filePreview &&
        (run.specification.filePreview.total > 0 ||
          run.specification.filePreview.warning ||
          run.specification.filePreview.declaredTotal > 0)
    )
    .map((run) => ({
      runId: run.id,
      serviceName: run.serviceName,
      databaseName: run.database.name,
      phaseLabel: getMigrationPhaseLabel(run.specification.phase),
      tool: run.specification.tool,
      preview: run.specification.filePreview!,
    }));

  return (
    <section className="console-panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold">变更</div>
        {previousReleaseLink ? (
          <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3">
            <Link href={`/projects/${projectId}/delivery/${previousReleaseLink.id}`}>
              对比上一版：{previousReleaseLink.title}
            </Link>
          </Button>
        ) : (
          <Badge variant="outline">首次发布</Badge>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              镜像变化
            </div>
            {release.diff.changedArtifacts.length > 0 && (
              <Badge variant="outline">{release.diff.changedArtifacts.length} 项</Badge>
            )}
          </div>
          {release.diff.changedArtifacts.length === 0 ? (
            <div className="console-surface rounded-2xl px-4 py-6 text-sm text-muted-foreground">
              没有镜像变化。
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
                    {item.change === 'added' ? '新增' : item.change === 'updated' ? '更新' : '移除'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.previousImageUrl && item.currentImageUrl
                    ? `${formatArtifactReference(item.previousImageUrl) ?? '上一版'} -> ${
                        formatArtifactReference(item.currentImageUrl) ?? '当前版'
                      }`
                    : (formatArtifactReference(item.currentImageUrl) ??
                      formatArtifactReference(item.previousImageUrl) ??
                      '镜像已变化')}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              迁移变化
            </div>
            {release.diff.changedMigrations.length > 0 && (
              <Badge variant="outline">{release.diff.changedMigrations.length} 项</Badge>
            )}
          </div>
          {release.diff.changedMigrations.length === 0 ? (
            <div className="console-surface rounded-2xl px-4 py-6 text-sm text-muted-foreground">
              没有迁移变化。
            </div>
          ) : (
            release.diff.changedMigrations.map((item) => (
              <div key={item.key} className="console-card bg-secondary/20 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium">{item.label}</div>
                  <Badge variant="secondary">{item.change === 'added' ? '新增' : '移除'}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.tool} · {getMigrationPhaseLabel(item.phase)}
                </div>
              </div>
            ))
          )}

          <div className="pt-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              真实环境差异
            </div>
            {runtimeMigrationDiffItems.length === 0 ? (
              <div className="console-surface rounded-2xl px-4 py-4 text-sm text-muted-foreground">
                没有运行差异。
              </div>
            ) : (
              <div className="space-y-2">
                {runtimeMigrationDiffItems.map((item) => (
                  <div key={item.runId} className="console-surface rounded-2xl px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">
                        {item.serviceName} · {item.databaseName}
                      </div>
                      <Badge variant="outline">{item.phaseLabel}</Badge>
                      <Badge variant="secondary">{item.tool}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      待执行 {item.preview.total} · 已执行 {item.preview.executedTotal} · 声明{' '}
                      {item.preview.declaredTotal}
                    </div>
                    {item.preview.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.preview.files.map((file) => (
                          <div
                            key={`${item.runId}:${file}`}
                            className="break-all font-mono text-xs text-foreground"
                          >
                            {file}
                          </div>
                        ))}
                        {item.preview.truncated && (
                          <div className="text-xs text-muted-foreground">
                            文件较多，仅展示前 {item.preview.files.length} 项。
                          </div>
                        )}
                      </div>
                    )}
                    {item.preview.warning && (
                      <div className="mt-2 text-xs text-warning">{item.preview.warning}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReleaseExecutionSections({
  projectId,
  releaseId,
  role,
  release,
  releasePlanSnapshot,
  incidentSnapshot,
}: {
  projectId: string;
  releaseId: string;
  role: TeamRole;
  release: ReleasePageData['release'];
  releasePlanSnapshot: Awaited<
    ReturnType<
      typeof import('@/lib/ai/runtime/plugin-service').resolveAIPluginSnapshot<
        import('@/lib/ai/schemas/release-plan').ReleasePlan
      >
    >
  >;
  incidentSnapshot: Awaited<
    ReturnType<
      typeof import('@/lib/ai/runtime/plugin-service').resolveAIPluginSnapshot<
        import('@/lib/ai/schemas/incident-analysis').IncidentAnalysis
      >
    >
  >;
}) {
  const releaseActions = buildReleaseEnvironmentActionSnapshot(role, release.environment);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        {release.environment?.deploymentStrategy &&
          release.environment.deploymentStrategy !== 'rolling' &&
          release.deploymentItems.some(
            (deployment) =>
              deployment.status === 'awaiting_rollout' ||
              deployment.status === 'verification_failed'
          ) && (
            <section className="console-panel p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Rocket className="h-4 w-4" />
                放量推进
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
                        projectId={projectId}
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
            <div className="console-surface rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground">
              没有部署记录。
            </div>
          ) : (
            <div className="space-y-3">
              {release.deploymentItems.map((deployment) => (
                <div key={deployment.id} className="console-card bg-secondary/20 px-4 py-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
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
                    <DeploymentRollbackAction
                      projectId={projectId}
                      deploymentId={deployment.id}
                      disabled={!releaseActions.canManage}
                      disabledSummary={releaseActions.summary}
                    />
                  </div>
                  {deployment.errorMessage && (
                    <div className="mb-3 rounded-2xl bg-destructive/[0.06] px-3 py-2 text-xs text-destructive shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
                      {deployment.errorMessage}
                    </div>
                  )}
                  <DeploymentLogs
                    projectId={projectId}
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
          <div className="mb-4 text-sm font-semibold">迁移记录</div>
          {release.migrationRuns.length === 0 ? (
            <div className="console-surface rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground">
              没有迁移记录。
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
                      <Badge variant="outline">{run.serviceName}</Badge>
                      <Badge variant="secondary">{run.database.name}</Badge>
                    </div>
                    <ReleaseMigrationActions
                      projectId={projectId}
                      runId={run.id}
                      status={run.status}
                      imageUrl={run.imageUrl}
                      disabled={!releaseActions.canManage}
                      disabledSummary={releaseActions.summary}
                    />
                  </div>
                  <MigrationSpecDetails
                    specification={run.specification}
                    databaseType={run.database.type ?? null}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <details className="console-panel p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold">分析</summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {release.sourceCommitSha && (
                <div className="console-card rounded-2xl px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    来源提交
                  </div>
                  <code className="mt-2 block text-sm font-mono text-foreground">
                    {release.sourceCommitSha.slice(0, 7)}
                  </code>
                </div>
              )}
              <div className="console-card rounded-2xl px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  仓库与更新时间
                </div>
                <div className="mt-2 text-sm text-foreground">{release.sourceRepository}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatPlatformDateTime(release.updatedAt) ?? '—'}
                </div>
              </div>
            </div>
            <ReleaseAISnapshotPanel
              projectId={projectId}
              releaseId={releaseId}
              releasePlan={releasePlanSnapshot}
              incidentAnalysis={incidentSnapshot}
            />
            <details className="console-surface rounded-2xl px-4 py-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                详细信息
              </summary>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <GitBranch className="h-3.5 w-3.5" />
                    来源分支
                  </span>
                  <span>{release.sourceRef}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    创建时间
                  </span>
                  <span>{formatPlatformDateTime(release.createdAt) ?? '—'}</span>
                </div>
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
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}

export function ReleaseMobileActions({
  environmentLogsHref,
  environmentDetailHref,
  releasesHref,
}: {
  environmentLogsHref: string;
  environmentDetailHref: string;
  releasesHref: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 px-4 lg:hidden">
      <div className="flex items-center gap-2 rounded-[24px] bg-background/95 p-2 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur">
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
  );
}
