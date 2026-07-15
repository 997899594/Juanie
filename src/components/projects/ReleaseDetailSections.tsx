import {
  Boxes,
  ChevronDown,
  Dot,
  Download,
  FileCode2,
  FileText,
  GitBranch,
  Package2,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArtifactDownloadButton } from '@/components/projects/ArtifactDownloadButton';
import { DeploymentLogs } from '@/components/projects/DeploymentLogs';
import { DeploymentRolloutAction } from '@/components/projects/DeploymentRolloutAction';
import { MigrationSpecDetails } from '@/components/projects/MigrationSpecDetails';
import { ReleaseMigrationActions } from '@/components/projects/ReleaseMigrationActions';
import { ReleaseMigrationPlanActions } from '@/components/projects/ReleaseMigrationPlanActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { TeamRole } from '@/lib/db/schema';
import {
  getMigrationPhaseLabel,
  getReleaseMigrationPlanStatusLabel,
} from '@/lib/migrations/presentation';
import { getMigrationReleaseStageLabel } from '@/lib/migrations/release-graph';
import {
  getDeliveryReleaseArtifacts,
  getDeployableReleaseArtifacts,
  getReleaseArtifactKindLabel,
  getReleaseArtifactUri,
} from '@/lib/releases/artifacts';
import { buildReleaseEnvironmentActionSnapshot } from '@/lib/releases/governance-view';
import { resolveReleaseLifecycle } from '@/lib/releases/lifecycle';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import type { getReleaseDetailPageData } from '@/lib/releases/service';
import { formatPlatformDateTime } from '@/lib/time/format';
import { cn } from '@/lib/utils';

type ReleasePageData = NonNullable<Awaited<ReturnType<typeof getReleaseDetailPageData>>>;
type ReleaseActionSnapshot = ReturnType<typeof buildReleaseEnvironmentActionSnapshot>;
type ReleaseDeploymentItem = ReleasePageData['release']['deploymentItems'][number];
type ReleaseMigrationItem = ReleasePageData['release']['migrationItems'][number];
type ReleaseArtifactItem = ReleasePageData['release']['artifacts'][number];

const releaseShellClassName = 'console-panel px-5 py-5';
const releaseSubtleClassName = 'console-inset px-4 py-4';
const releaseSectionTitleClassName =
  'text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground';
const actionableMigrationStatuses = new Set([
  'awaiting_approval',
  'awaiting_external_completion',
  'failed',
]);

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
      phaseLabel:
        run.specification.releaseStage !== 'standard'
          ? getMigrationReleaseStageLabel(run.specification.releaseStage)
          : getMigrationPhaseLabel(run.specification.phase),
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

function SectionHeading({
  icon,
  title,
  description,
  meta,
}: {
  icon: ReactNode;
  title: string;
  description?: string | null;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </div>
        {description ? (
          <div className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
    </div>
  );
}

function isActionableMigration(run: ReleaseMigrationItem): boolean {
  return actionableMigrationStatuses.has(run.status);
}

function getMigrationReviewSummary(migrationItems: ReleaseMigrationItem[]): string {
  const previewCount = migrationItems.filter((run) => run.specification.filePreview).length;
  const pendingCount = migrationItems.filter((run) => isActionableMigration(run)).length;
  const failedCount = migrationItems.filter((run) => run.status === 'failed').length;
  const parts = [`${migrationItems.length} 条迁移记录`];

  if (previewCount > 0) {
    parts.push(`${previewCount} 个可审阅内容`);
  }

  if (pendingCount > 0) {
    parts.push(`${pendingCount} 个待处理`);
  }

  if (failedCount > 0) {
    parts.push(`${failedCount} 个失败`);
  }

  return parts.join(' · ');
}

function shouldOpenMigrationReview(run: ReleaseMigrationItem, index: number, total: number) {
  return total === 1 || index === 0 || isActionableMigration(run) || run.status === 'failed';
}

export function getActionableRolloutDeployments(
  release: Pick<ReleasePageData['release'], 'status' | 'deploymentItems'>
): ReleaseDeploymentItem[] {
  const lifecycle = resolveReleaseLifecycle({
    status: release.status,
    deployments: release.deploymentItems,
  });

  if (!lifecycle.canAcceptRolloutActions) {
    return [];
  }

  const actionableDeploymentIds = new Set(lifecycle.actionableRolloutDeploymentIds);
  return release.deploymentItems.filter((deployment) => actionableDeploymentIds.has(deployment.id));
}

function ReleaseRolloutActionSection({
  projectId,
  deployments,
  releaseActions,
  strategyLabel,
}: {
  projectId: string;
  deployments: ReleaseDeploymentItem[];
  releaseActions: ReleaseActionSnapshot;
  strategyLabel: string | null;
}) {
  if (deployments.length === 0) {
    return null;
  }

  return (
    <section className={releaseShellClassName}>
      <SectionHeading
        icon={<Rocket className="h-4 w-4 text-muted-foreground" />}
        title="需要操作"
        description="当前发布正在等待人工放量或校验后的继续处理。"
        meta={<Badge variant="secondary">{deployments.length} 项</Badge>}
      />

      <div className="space-y-3">
        {deployments.map((deployment) => (
          <div key={`rollout-${deployment.id}`} className={releaseSubtleClassName}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusIndicator
                    status={deployment.statusDecoration.color}
                    pulse={deployment.statusDecoration.pulse}
                    label={deployment.statusDecoration.label}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {deployment.serviceName}
                  </span>
                </div>
                {deployment.imageUrl ? (
                  <div className="mt-2 break-all text-xs text-muted-foreground">
                    {deployment.imageUrl}
                  </div>
                ) : null}
              </div>
              <DeploymentRolloutAction
                projectId={projectId}
                deploymentId={deployment.id}
                strategyLabel={strategyLabel}
                disabled={!releaseActions.canManage}
                disabledSummary={releaseActions.summary}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReleaseMigrationReviewSection({
  projectId,
  releaseId,
  migrationItems,
  migrationPlan,
  migrationPlanApprovalToken,
  releaseActions,
  isDeliveryRole,
}: {
  projectId: string;
  releaseId: string;
  migrationItems: ReleaseMigrationItem[];
  migrationPlan: ReleasePageData['release']['migrationPlan'];
  migrationPlanApprovalToken?: string | null;
  releaseActions: ReleaseActionSnapshot;
  isDeliveryRole: boolean;
}) {
  if (migrationItems.length === 0) {
    return null;
  }

  const disabled = isDeliveryRole || !releaseActions.canManage;
  const disabledSummary = isDeliveryRole
    ? '交付角色只能查看迁移审阅内容。'
    : releaseActions.summary;

  return (
    <section className={releaseShellClassName}>
      <SectionHeading
        icon={<FileCode2 className="h-4 w-4 text-muted-foreground" />}
        title="迁移审阅"
        meta={<Badge variant="secondary">{getMigrationReviewSummary(migrationItems)}</Badge>}
      />

      {migrationPlan ? (
        <div className="mb-3 flex flex-col gap-3 border-border/65 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">发布迁移计划</span>
              <Badge variant="secondary">{migrationItems.length} 个阶段</Badge>
              <Badge variant="outline">commit {migrationPlan.sourceCommitSha.slice(0, 12)}</Badge>
            </div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              SHA-256 {migrationPlan.digest.slice(0, 16)}
            </div>
          </div>
          {migrationPlan.status === 'awaiting_approval' ? (
            <ReleaseMigrationPlanActions
              projectId={projectId}
              releaseId={releaseId}
              approvalToken={migrationPlanApprovalToken}
              disabled={disabled}
              disabledSummary={disabledSummary}
            />
          ) : (
            <Badge variant="secondary">
              {getReleaseMigrationPlanStatusLabel(migrationPlan.status)}
            </Badge>
          )}
        </div>
      ) : null}

      <div className="space-y-3">
        {migrationItems.map((run, index) => {
          const filePreview = run.specification.filePreview;
          const phaseLabel =
            run.specification.releaseStage !== 'standard'
              ? getMigrationReleaseStageLabel(run.specification.releaseStage)
              : getMigrationPhaseLabel(run.specification.phase);
          const meta = [
            run.serviceName,
            run.database.name,
            run.database.type,
            run.specification.tool,
            phaseLabel,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div key={run.id} className="console-inset overflow-hidden">
              <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusIndicator
                      status={run.statusDecoration.color}
                      pulse={run.statusDecoration.pulse}
                      label={run.statusDecoration.label}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {run.database.name}
                    </span>
                    <Badge variant="secondary">{phaseLabel}</Badge>
                    <Badge variant="secondary">{run.specification.tool}</Badge>
                  </div>
                  <div className="mt-2 break-words text-xs text-muted-foreground">{meta}</div>
                </div>

                <ReleaseMigrationActions
                  projectId={projectId}
                  runId={run.id}
                  status={run.status}
                  approvalToken={run.approvalToken}
                  disabled={disabled}
                  disabledSummary={disabledSummary}
                />
              </div>

              <details
                className="group border-border/65 border-t"
                open={shouldOpenMigrationReview(run, index, migrationItems.length)}
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-foreground/[0.025]">
                  <span className="text-sm font-medium text-foreground">迁移内容</span>
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    {filePreview ? (
                      <span className="truncate">
                        {filePreview.sourceLabel} · 待执行 {filePreview.total} · 已执行{' '}
                        {filePreview.executedTotal} · 声明 {filePreview.declaredTotal}
                      </span>
                    ) : (
                      <span>配置与执行命令</span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                  </span>
                </summary>
                <div className="px-4 pb-4">
                  <MigrationSpecDetails
                    specification={run.specification}
                    databaseType={run.database.type ?? null}
                  />
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReleaseDeliveryArtifactsSection({
  artifacts,
  releaseId,
}: {
  artifacts: ReleaseArtifactItem[];
  releaseId: string;
}) {
  return (
    <section className={releaseShellClassName}>
      <SectionHeading
        icon={<Package2 className="h-4 w-4 text-muted-foreground" />}
        title="交付物"
        meta={
          artifacts.length > 0 ? <Badge variant="secondary">{artifacts.length} 个</Badge> : null
        }
      />

      {artifacts.length === 0 ? (
        <div className="console-inset px-4 py-6 text-sm text-muted-foreground">
          这次发布没有交付物。
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {artifacts.map((artifact) => {
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
    </section>
  );
}

function ReleaseDeploymentArtifactsSection({ artifacts }: { artifacts: ReleaseArtifactItem[] }) {
  return (
    <details className={cn(releaseShellClassName, 'group')}>
      <summary className="-m-2 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[14px] px-2 py-2 transition hover:bg-foreground/[0.035]">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          部署镜像
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {artifacts.length} 个服务镜像
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </span>
      </summary>

      <div className="mt-4">
        {artifacts.length === 0 ? (
          <div className="console-inset px-4 py-5 text-sm text-muted-foreground">
            没有服务镜像。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id ?? artifact.service?.id ?? getArtifactTitle(artifact)}
                className={releaseSubtleClassName}
              >
                <div className="text-sm font-medium text-foreground">
                  {getArtifactTitle(artifact)}
                </div>
                <div className="mt-2 break-all text-xs leading-5 text-muted-foreground">
                  {getArtifactReference(artifact) ?? '等待镜像回传'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function DeploymentDiagnosticBlock({ deployment }: { deployment: ReleaseDeploymentItem }) {
  const diagnostic = deployment.diagnostic;

  if (!diagnostic) {
    return null;
  }

  const snapshot = diagnostic.snapshot;
  const capturedAt = formatPlatformDateTime(diagnostic.capturedAt);
  const primaryEvent = snapshot.events[0] ?? null;
  const primaryLogTail = snapshot.logTails[0] ?? null;

  return (
    <div className="mb-3 rounded-2xl border border-warning/30 bg-warning/[0.06] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4 text-warning" />
          诊断快照
        </div>
        <div className="text-xs text-muted-foreground">{capturedAt ?? '刚刚采集'}</div>
      </div>
      <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
        {diagnostic.summary}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-xl bg-background/70 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workload
          </div>
          <div className="mt-1 break-words text-xs leading-5 text-foreground">
            {snapshot.workload.summary}
          </div>
        </div>
        <div className="rounded-xl bg-background/70 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Pod
          </div>
          <div className="mt-1 break-words text-xs leading-5 text-foreground">
            {snapshot.pods[0]?.summary ?? '没有捕获到 Pod'}
          </div>
        </div>
      </div>
      {primaryEvent ? (
        <div className="mt-2 rounded-xl bg-background/70 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Event
          </div>
          <div className="mt-1 break-words text-xs leading-5 text-foreground">
            {[primaryEvent.involvedObjectName, primaryEvent.reason, primaryEvent.message]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      ) : null}
      {primaryLogTail ? (
        <details className="mt-2 rounded-xl bg-background/70 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-foreground">
            查看容器日志尾部
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-foreground/[0.04] p-3 text-[11px] leading-5 text-muted-foreground">
            {primaryLogTail.text}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function ReleaseDeploymentLogsSection({
  projectId,
  deploymentItems,
}: {
  projectId: string;
  deploymentItems: ReleaseDeploymentItem[];
}) {
  return (
    <details className={cn(releaseShellClassName, 'group')}>
      <summary className="-m-2 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[14px] px-2 py-2 transition hover:bg-foreground/[0.035]">
        <span className="text-sm font-semibold text-foreground">部署日志</span>
        <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {deploymentItems.length} 条部署记录
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="mt-4 space-y-3">
        {deploymentItems.length === 0 ? (
          <div className="console-inset px-4 py-5 text-sm text-muted-foreground">
            没有部署记录。
          </div>
        ) : (
          deploymentItems.map((deployment) => (
            <div key={deployment.id} className={releaseSubtleClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusIndicator
                    status={deployment.statusDecoration.color}
                    pulse={deployment.statusDecoration.pulse}
                    label={deployment.statusDecoration.label}
                  />
                  <Badge variant="secondary">{deployment.serviceName}</Badge>
                  {deployment.version ? (
                    <Badge variant="secondary">v{deployment.version}</Badge>
                  ) : null}
                </div>
              </div>
              {deployment.errorMessage ? (
                <div className="mb-3 whitespace-pre-wrap break-words rounded-2xl bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                  {deployment.errorMessage}
                </div>
              ) : null}
              <DeploymentDiagnosticBlock deployment={deployment} />
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
  const rolloutDeploymentItems = getActionableRolloutDeployments(release);
  const isDeliveryRole = role === 'delivery';
  const hasRolloutActions =
    !isDeliveryRole &&
    release.environment?.deploymentStrategy &&
    release.environment.deploymentStrategy !== 'rolling' &&
    rolloutDeploymentItems.length > 0;

  return (
    <div className="space-y-4">
      {hasRolloutActions ? (
        <ReleaseRolloutActionSection
          projectId={projectId}
          deployments={rolloutDeploymentItems}
          releaseActions={releaseActions}
          strategyLabel={release.environmentStrategy}
        />
      ) : null}

      <ReleaseMigrationReviewSection
        projectId={projectId}
        releaseId={releaseId}
        migrationItems={release.migrationItems}
        migrationPlan={release.migrationPlan}
        migrationPlanApprovalToken={release.migrationPlanApprovalToken}
        releaseActions={releaseActions}
        isDeliveryRole={isDeliveryRole}
      />

      <ReleaseDeliveryArtifactsSection artifacts={deliveryArtifacts} releaseId={releaseId} />

      <ReleaseDeploymentArtifactsSection artifacts={deployableArtifacts} />

      {isDeliveryRole ? null : (
        <ReleaseDeploymentLogsSection
          projectId={projectId}
          deploymentItems={release.deploymentItems}
        />
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
                <Button asChild variant="ghost" size="sm" className="h-8 px-3">
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
    <div className={releaseSubtleClassName}>
      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
        <span className="min-w-0 break-words">{getArtifactTitle(artifact)}</span>
        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
          {getReleaseArtifactKindLabel(artifact)}
        </Badge>
      </div>
      {getArtifactMeta(artifact) && (
        <div className="mb-2 break-words text-xs text-muted-foreground">
          {getArtifactMeta(artifact)}
        </div>
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
          <Button asChild variant="ghost" size="sm">
            <a href={reference} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5" />
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
