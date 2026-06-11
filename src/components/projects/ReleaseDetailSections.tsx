import { Boxes, ChevronDown, Dot, FileCode2, GitBranch, Package2, Rocket } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArtifactDownloadButton } from '@/components/projects/ArtifactDownloadButton';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { DeploymentRolloutAction } from '@/components/projects/DeploymentRolloutAction';
import { MigrationSpecDetails } from '@/components/projects/MigrationSpecDetails';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { TeamRole } from '@/lib/db/schema';
import { getMigrationPhaseLabel } from '@/lib/migrations/presentation';
import {
  getDeliveryReleaseArtifacts,
  getDeployableReleaseArtifacts,
  getReleaseArtifactKindLabel,
  getReleaseArtifactUri,
} from '@/lib/releases/artifacts';
import { buildReleaseEnvironmentActionSnapshot } from '@/lib/releases/governance-view';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import type { getReleaseDetailPageData } from '@/lib/releases/service';
import { formatPlatformDateTime } from '@/lib/time/format';
import { cn } from '@/lib/utils';

type ReleasePageData = NonNullable<Awaited<ReturnType<typeof getReleaseDetailPageData>>>;

const releaseShellClassName = 'console-panel px-5 py-5';
const releaseSubtleClassName = 'console-inset px-4 py-4';
const releaseSectionTitleClassName =
  'text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground';

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

function getArtifactReference(artifact: ReleasePageData['release']['artifacts'][number]) {
  return getReleaseArtifactUri(artifact);
}

function getArtifactTitle(artifact: ReleasePageData['release']['artifacts'][number]) {
  const fallback = [artifact.name, artifact.variant, artifact.platform].filter(Boolean).join(' / ');
  return artifact.service?.name ?? (fallback || 'artifact');
}

function getArtifactMeta(artifact: ReleasePageData['release']['artifacts'][number]): string {
  return [
    artifact.platform,
    artifact.format,
    artifact.sourceImageDigest ? `image ${artifact.sourceImageDigest.slice(0, 18)}...` : null,
    artifact.status,
  ]
    .filter(Boolean)
    .join(' · ');
}

function isExternalArtifactReference(reference: string | null): reference is string {
  return Boolean(reference?.startsWith('https://') || reference?.startsWith('http://'));
}

function isManagedArtifactReference(reference: string | null): reference is string {
  return Boolean(reference?.startsWith('s3://'));
}

function getPrimaryReleaseSummary(release: ReleasePageData['release']): string | null {
  const summary =
    release.blockingReason?.summary ??
    release.platformSignals.primarySummary ??
    release.narrativeSummary.risk ??
    release.narrativeSummary.changed ??
    null;

  if (!summary || summary === release.statusDecoration.label) {
    return null;
  }

  return summary;
}

function getRuntimeMigrationDiffItems(release: ReleasePageData['release']) {
  return release.migrationItems
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
}

function getArtifactChangeLabel(change: string): string {
  if (change === 'added') return '新增';
  if (change === 'updated') return '更新';
  if (change === 'removed') return '移除';
  return '变更';
}

function SummaryBlock({
  title,
  children,
  subdued = false,
}: {
  title: string;
  children: ReactNode;
  subdued?: boolean;
}) {
  return (
    <div
      className={cn('rounded-[14px] px-3 py-3', subdued ? 'bg-background/45' : 'bg-background/70')}
    >
      <div className={releaseSectionTitleClassName}>{title}</div>
      <div className="mt-2 text-sm leading-6 text-foreground">{children}</div>
    </div>
  );
}

function InlineFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-border/65 border-t py-2 first:border-t-0 first:pt-0 last:pb-0">
      <div className="shrink-0 text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0 text-right text-sm text-foreground">{children}</div>
    </div>
  );
}

function DiffRow({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-background/65 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {badge ? (
          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1 break-all text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

export function ReleaseResultSection({ release }: { release: ReleasePageData['release'] }) {
  const primarySummary = getPrimaryReleaseSummary(release);
  const visibleStats = release.stats.filter((stat) => Number(stat.value) > 0);

  return (
    <section className="console-panel px-5 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <StatusIndicator
            status={release.statusDecoration.color}
            pulse={release.statusDecoration.pulse}
            label={release.statusDecoration.label}
          />
          {primarySummary ? (
            <div className="mt-3 max-w-4xl text-sm leading-6 text-foreground">{primarySummary}</div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{release.environment?.name ?? '环境'}</Badge>
            {release.environmentScope ? (
              <Badge variant="secondary">{release.environmentScope}</Badge>
            ) : null}
            {release.previewSourceMeta.label ? (
              <Badge variant="secondary">{release.previewSourceMeta.label}</Badge>
            ) : null}
          </div>
        </div>

        {visibleStats.length > 0 ? (
          <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
            {visibleStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-full bg-background/70 px-3 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]"
              >
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <span className="ml-2 text-sm font-semibold text-foreground">{stat.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ReleaseExecutionSections({
  projectId,
  releaseId,
  role,
  release,
}: {
  projectId: string;
  releaseId: string;
  role: TeamRole;
  release: ReleasePageData['release'];
}) {
  const releaseActions = buildReleaseEnvironmentActionSnapshot(role, release.environment);
  const deployableArtifacts = getDeployableReleaseArtifacts(release.artifacts);
  const deliveryArtifacts = getDeliveryReleaseArtifacts(release.artifacts);
  const rolloutDeploymentItems = release.deploymentItems.filter(
    (deployment) =>
      deployment.status === 'awaiting_rollout' || deployment.status === 'verification_failed'
  );
  const actionableMigrationItems = release.migrationItems.filter((run) =>
    ['awaiting_approval', 'awaiting_external_completion', 'failed'].includes(run.status)
  );
  const isDeliveryRole = role === 'delivery';
  const hasRolloutActions =
    !isDeliveryRole &&
    release.environment?.deploymentStrategy &&
    release.environment.deploymentStrategy !== 'rolling' &&
    rolloutDeploymentItems.length > 0;
  const hasMigrationActions = !isDeliveryRole && actionableMigrationItems.length > 0;
  const hasActions = hasRolloutActions || hasMigrationActions;
  const migrationSummary =
    release.migrationItems.length === 0
      ? '这次发布没有迁移记录。'
      : `${release.migrationItems.length} 条迁移记录`;

  return (
    <div className="space-y-4">
      {hasActions ? (
        <section className={releaseShellClassName}>
          <div className="mb-4 text-sm font-semibold">需要操作</div>

          {hasRolloutActions ? (
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Rocket className="h-4 w-4" />
                放量
              </div>
              <div className="space-y-3">
                {rolloutDeploymentItems.map((deployment) => (
                  <div key={`rollout-${deployment.id}`} className={releaseSubtleClassName}>
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
            </div>
          ) : null}

          {hasMigrationActions ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">迁移审批 / 处理</div>
              {actionableMigrationItems.map((run) => (
                <div key={run.id} className={releaseSubtleClassName}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={run.statusDecoration.color}
                        pulse={run.statusDecoration.pulse}
                        label={run.statusDecoration.label}
                      />
                      <Badge variant="secondary">{run.serviceName}</Badge>
                      <Badge variant="secondary">{run.database.name}</Badge>
                    </div>
                    <ReleaseMigrationActions
                      projectId={projectId}
                      runId={run.id}
                      status={run.status}
                      approvalToken={run.approvalToken}
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
          ) : null}
        </section>
      ) : null}

      <section className={releaseShellClassName}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package2 className="h-4 w-4" />
                交付物
              </div>
              {deliveryArtifacts.length > 0 ? (
                <Badge variant="secondary">{deliveryArtifacts.length} 个</Badge>
              ) : null}
            </div>
            {deliveryArtifacts.length === 0 ? (
              <div className="console-inset px-4 py-6 text-sm text-muted-foreground">
                这次发布没有交付物。
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {deliveryArtifacts.map((artifact) => {
                  const reference = getArtifactReference(artifact);

                  return (
                    <DeliveryArtifactCard
                      key={artifact.id ?? getArtifactTitle(artifact)}
                      artifact={artifact}
                      reference={reference}
                      releaseId={releaseId}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="console-inset px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileCode2 className="h-4 w-4 text-muted-foreground" />
                迁移
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{migrationSummary}</div>
              {release.migrationItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {release.migrationItems.map((run) => (
                    <details
                      key={run.id}
                      className="group rounded-[14px] bg-background/65 px-3 py-2"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-foreground">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{run.database.name}</span>
                          <Badge variant="secondary" className="shrink-0 px-2 py-0 text-[10px]">
                            {run.statusDecoration.label}
                          </Badge>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                      </summary>
                      <div className="mt-3">
                        <MigrationSpecDetails
                          specification={run.specification}
                          databaseType={run.database.type ?? null}
                          compact
                        />
                      </div>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>

            <details className="group console-inset px-4 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  部署镜像
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="mt-4">
                {deployableArtifacts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">没有服务镜像。</div>
                ) : (
                  <div className="space-y-2">
                    {deployableArtifacts.map((artifact) => (
                      <div
                        key={artifact.id ?? artifact.service?.id ?? getArtifactTitle(artifact)}
                        className="rounded-[14px] bg-background/65 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {getArtifactTitle(artifact)}
                        </div>
                        <div className="mt-1 break-all text-xs text-muted-foreground">
                          {getArtifactReference(artifact) ?? '等待镜像回传'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </aside>
        </div>
      </section>

      {isDeliveryRole ? null : (
        <details className={cn(releaseShellClassName, 'group')}>
          <summary className="-m-2 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[14px] px-2 py-2 transition hover:bg-foreground/[0.035]">
            <span className="text-sm font-semibold text-foreground">部署日志</span>
            <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
              {release.deploymentItems.length} 条部署记录
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {release.deployments.length === 0 ? (
              <div className="console-inset px-4 py-5 text-sm text-muted-foreground">
                没有部署记录。
              </div>
            ) : (
              release.deploymentItems.map((deployment) => (
                <div key={deployment.id} className={releaseSubtleClassName}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator
                        status={deployment.statusDecoration.color}
                        pulse={deployment.statusDecoration.pulse}
                        label={deployment.statusDecoration.label}
                      />
                      <Badge variant="secondary">{deployment.serviceName}</Badge>
                      {deployment.version && (
                        <Badge variant="secondary">v{deployment.version}</Badge>
                      )}
                    </div>
                  </div>
                  {deployment.errorMessage && (
                    <div className="mb-3 rounded-2xl bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                      {deployment.errorMessage}
                    </div>
                  )}
                  <DeploymentLogs
                    projectId={projectId}
                    deploymentId={deployment.id}
                    status={deployment.status}
                  />
                </div>
              ))
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export function ReleaseOverviewDetails({
  projectId,
  sourceReleaseLink,
  previousReleaseLink,
  release,
}: {
  projectId: string;
  sourceReleaseLink: ReleasePageData['sourceReleaseLink'];
  previousReleaseLink: ReleasePageData['previousReleaseLink'];
  release: ReleasePageData['release'];
}) {
  const runtimeMigrationDiffItems = getRuntimeMigrationDiffItems(release);
  const hasArtifactChanges = release.diff.changedArtifacts.length > 0;
  const hasMigrationConfigChanges = release.diff.changedMigrations.length > 0;
  const hasRuntimeMigrationChanges = runtimeMigrationDiffItems.length > 0;
  const hasDatabaseChanges = hasMigrationConfigChanges || hasRuntimeMigrationChanges;
  const metadataItems = release.metadataItems.filter(
    (item) => !['来源发布', '更新时间'].includes(item.label)
  );

  return (
    <details className={cn(releaseShellClassName, 'group')}>
      <summary className="-m-2 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[14px] px-2 py-2 transition hover:bg-foreground/[0.035]">
        <span className="text-sm font-semibold text-foreground">发布详情</span>
        <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
          来源、差异、运行记录
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </span>
      </summary>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <section className="grid gap-3 md:grid-cols-2">
            {release.blockingReason ? (
              <SummaryBlock title="阻塞">{release.blockingReason.summary}</SummaryBlock>
            ) : null}
            <SummaryBlock title="变化">{release.narrativeSummary.changed}</SummaryBlock>
            <SummaryBlock title="风险">{release.narrativeSummary.risk}</SummaryBlock>
            <SummaryBlock title="结果">{release.narrativeSummary.result}</SummaryBlock>
            {release.narrativeSummary.governance ? (
              <SummaryBlock title="处理">{release.narrativeSummary.governance}</SummaryBlock>
            ) : null}
            {release.narrativeSummary.nextAction ? (
              <SummaryBlock title="下一步">{release.narrativeSummary.nextAction}</SummaryBlock>
            ) : null}
            {release.infrastructureDiagnostics ? (
              <SummaryBlock title="容量" subdued>
                剩余 {release.infrastructureDiagnostics.capacity.availableMemoryLabel}
                {release.infrastructureDiagnostics.capacity.saturationLabel
                  ? ` · 使用率 ${release.infrastructureDiagnostics.capacity.saturationLabel}`
                  : ''}
                <span className="mt-1 block text-muted-foreground">
                  已请求 {release.infrastructureDiagnostics.capacity.requestedMemoryLabel} / 可分配{' '}
                  {release.infrastructureDiagnostics.capacity.allocatableMemoryLabel}
                </span>
              </SummaryBlock>
            ) : null}
          </section>

          <section className="rounded-[16px] bg-background/45 px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-foreground">版本差异</div>
              {previousReleaseLink ? (
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3">
                  <Link
                    href={buildReleaseDetailPath(
                      projectId,
                      previousReleaseLink.environmentId,
                      previousReleaseLink.id
                    )}
                  >
                    对比上一版
                  </Link>
                </Button>
              ) : (
                <Badge variant="secondary">首次发布</Badge>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <div className={releaseSectionTitleClassName}>镜像变化</div>
                {hasArtifactChanges ? (
                  release.diff.changedArtifacts.map((item) => (
                    <DiffRow
                      key={`${item.serviceId}:${item.change}`}
                      title={item.serviceName}
                      badge={getArtifactChangeLabel(item.change)}
                    >
                      {item.previousImageUrl && item.currentImageUrl
                        ? `${formatArtifactReference(item.previousImageUrl) ?? '上一版'} -> ${
                            formatArtifactReference(item.currentImageUrl) ?? '当前版'
                          }`
                        : (formatArtifactReference(item.currentImageUrl) ??
                          formatArtifactReference(item.previousImageUrl) ??
                          '制品已变化')}
                    </DiffRow>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">部署镜像与上一版一致。</div>
                )}
              </div>

              <div className="min-w-0 space-y-2">
                <div className={releaseSectionTitleClassName}>数据库变化</div>
                {!hasDatabaseChanges ? (
                  <div className="text-sm text-muted-foreground">没有数据库变更。</div>
                ) : null}

                {release.diff.changedMigrations.map((item) => (
                  <DiffRow
                    key={item.key}
                    title={item.label}
                    badge={item.change === 'added' ? '新增' : '移除'}
                  >
                    {item.tool} · {getMigrationPhaseLabel(item.phase)}
                  </DiffRow>
                ))}

                {runtimeMigrationDiffItems.map((item) => (
                  <DiffRow
                    key={item.runId}
                    title={`${item.serviceName} · ${item.databaseName}`}
                    badge={item.phaseLabel}
                  >
                    待执行 {item.preview.total} · 已执行 {item.preview.executedTotal} · 声明{' '}
                    {item.preview.declaredTotal}
                    {item.preview.warning ? ` · ${item.preview.warning}` : ''}
                  </DiffRow>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[16px] bg-background/45 px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              来源
            </div>
            <div className="space-y-0">
              <InlineFact label="分支">
                <span className="break-all">{release.sourceRef}</span>
              </InlineFact>
              {release.sourceCommitSha ? (
                <InlineFact label="提交">
                  <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                    {release.sourceCommitSha.slice(0, 7)}
                  </code>
                </InlineFact>
              ) : null}
              <InlineFact label="更新时间">
                {formatPlatformDateTime(release.updatedAt) ?? '—'}
              </InlineFact>
              {sourceReleaseLink ? (
                <InlineFact label="来源发布">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link
                      href={buildReleaseDetailPath(
                        projectId,
                        sourceReleaseLink.environmentId,
                        sourceReleaseLink.id
                      )}
                    >
                      {sourceReleaseLink.environmentName} · {sourceReleaseLink.title}
                    </Link>
                  </Button>
                </InlineFact>
              ) : null}
              {previousReleaseLink ? (
                <InlineFact label="上一版">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link
                      href={buildReleaseDetailPath(
                        projectId,
                        previousReleaseLink.environmentId,
                        previousReleaseLink.id
                      )}
                    >
                      {previousReleaseLink.title}
                    </Link>
                  </Button>
                </InlineFact>
              ) : null}
              {metadataItems.map((item) => (
                <InlineFact key={item.label} label={item.label}>
                  {item.mono ? (
                    <code className="break-all rounded bg-muted px-2 py-1 text-xs font-mono">
                      {item.value}
                    </code>
                  ) : (
                    <span className="break-words">{item.value}</span>
                  )}
                </InlineFact>
              ))}
            </div>
          </section>

          <section className="rounded-[16px] bg-background/45 px-4 py-4">
            <div className="mb-3 text-sm font-semibold text-foreground">运行记录</div>
            <div className="max-h-80 space-y-0 overflow-auto pr-1">
              {release.timeline.map((item, index) => (
                <div key={item.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={getToneClass(item.tone)}>
                      <Dot className="h-5 w-5" />
                    </div>
                    {index < release.timeline.length - 1 ? (
                      <div className="mt-1 h-full w-px bg-border" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      {item.at ? (
                        <div className="text-xs text-muted-foreground">{item.at}</div>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </details>
  );
}

function DeliveryArtifactCard({
  artifact,
  reference,
  releaseId,
}: {
  artifact: ReleasePageData['release']['artifacts'][number];
  reference: string | null;
  releaseId: string;
}) {
  return (
    <div className={cn(releaseSubtleClassName, 'break-all')}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
        <span>{getArtifactTitle(artifact)}</span>
        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
          {getReleaseArtifactKindLabel(artifact)}
        </Badge>
      </div>
      {getArtifactMeta(artifact) && (
        <div className="mb-2 text-xs text-muted-foreground">{getArtifactMeta(artifact)}</div>
      )}
      {isManagedArtifactReference(reference) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ArtifactDownloadButton
            releaseId={artifact.releaseId ?? releaseId}
            artifactId={artifact.id}
          />
          <span className="break-all text-xs text-muted-foreground">
            {formatArtifactReference(reference)}
          </span>
        </div>
      ) : isExternalArtifactReference(reference) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <a href={reference} target="_blank" rel="noreferrer">
              下载
            </a>
          </Button>
          <span className="break-all text-xs text-muted-foreground">
            {formatArtifactReference(reference)}
          </span>
        </div>
      ) : (
        <div className="break-all text-xs text-muted-foreground">
          {reference ?? '等待交付物回传'}
        </div>
      )}
    </div>
  );
}
