import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import {
  formatEnvironmentExpiry,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import type { PreviewReviewMetadata } from '@/lib/environments/review-metadata';
import {
  buildPreviewSourceMetadata,
  type PreviewSourceMetadata,
} from '@/lib/environments/source-metadata';
import type { ProjectGovernanceCapability } from '@/lib/projects/settings-view';
import {
  buildIssueSnapshot,
  type DatabaseManualControlSnapshot,
  getDatabaseManualControlSnapshot,
  getIssueLabel,
  getMigrationAttentionIssueCode,
  getReleaseActionLabel,
  type ReleaseIssueCode,
  type ReleaseIssueSnapshot,
} from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformDate } from '@/lib/time/format';

export interface ProjectDatabaseLike {
  id: string;
  name?: string;
  type?: string;
  status?: string | null;
  scope?: string | null;
  environmentId?: string | null;
  serviceId?: string | null;
}

export interface ProjectServiceLike {
  id: string;
  name: string;
  type?: string;
  status?: string | null;
  port?: number | null;
}

export interface ProjectMigrationRunLike {
  id: string;
  databaseId: string;
  status: string;
  releaseId?: string | null;
}

export interface ProjectAttentionRunLike {
  id?: string;
  projectId?: string;
  status: string;
  releaseId?: string | null;
  createdAt?: Date | string | null;
  database?: {
    name?: string;
  } | null;
  service?: {
    name?: string;
  } | null;
  environment?: {
    name?: string | null;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
    }> | null;
  } | null;
  release?: {
    id?: string;
    summary?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    environment?: {
      isPreview?: boolean | null;
    } | null;
  } | null;
  previewReviewMetadata?: PreviewReviewMetadata | null;
}

export interface ProjectDeploymentLike {
  environmentId: string;
  serviceId?: string | null;
  imageUrl?: string | null;
}

export interface ProjectDomainLike {
  id?: string;
  hostname: string;
}

export interface ProjectOverviewProjectLike {
  status?: string | null;
  createdAt?: Date | string | null;
  productionBranch?: string | null;
  description?: string | null;
  repository?: {
    fullName: string;
    webUrl?: string | null;
  } | null;
}

export interface ProjectReleaseLike {
  id: string;
  projectId?: string;
  status?: string;
  createdAt?: Date | string | null;
  environment: {
    id: string;
    name?: string;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
    }> | null;
  };
  sourceCommitSha?: string | null;
  sourceRef?: string | null;
  summary?: string | null;
  artifacts: Array<{
    service: {
      id: string;
      name: string;
    };
  }>;
  previewReviewMetadata?: PreviewReviewMetadata | null;
}

export interface ProjectDatabaseCardDecorations {
  serviceName: string | null;
  latestMigration: {
    id: string;
    status: string;
    releaseId?: string | null;
  } | null;
  latestRelease: {
    id: string;
    title: string;
    commitSha?: string | null;
  } | null;
  latestImageUrl: string | null;
  manualControl: DatabaseManualControlSnapshot;
  manualMigrationAction: {
    allowed: boolean;
    summary: string | null;
  };
}

export interface ProjectAttentionItemDecorations {
  platformSignals: PlatformSignalSnapshot;
  issue: ReleaseIssueSnapshot | null;
  issueCode: ReleaseIssueCode | null;
  issueLabel: string | null;
  actionLabel: string | null;
  environmentScopeLabel: string | null;
  environmentSourceLabel: string | null;
  environmentExpiryLabel: string | null;
  primaryDomainUrl: string | null;
  releaseTitle: string | null;
  previewSourceMeta: PreviewSourceMetadata;
  previewLifecycle: PreviewLifecycleSummary | null;
}

export interface ProjectOverviewStat {
  label: string;
  value: number;
}

export interface ProjectRecentReleaseDecorations {
  title: string;
  shortCommitSha: string | null;
  sourceSummary: string | null;
  environmentScopeLabel: string | null;
  environmentSourceLabel: string | null;
  environmentExpiryLabel: string | null;
  primaryDomainUrl: string | null;
  previewSourceMeta: PreviewSourceMetadata;
  previewLifecycle: PreviewLifecycleSummary | null;
  platformSignals: PlatformSignalSnapshot;
}

export interface ProjectOverviewDetails {
  headerDescription: string;
  repository: {
    fullName: string;
    webUrl: string | null;
  } | null;
  productionBranch: string | null;
  description: string | null;
  statusLabel: string;
  createdDateLabel: string;
}

export interface ProjectServiceDecorations {
  statusLabel: string;
  portLabel: string | null;
}

export interface ProjectDomainDecorations {
  url: string;
}

function getScopeKey(environmentId?: string | null, serviceId?: string | null): string {
  return `${environmentId ?? 'global'}:${serviceId ?? 'project'}`;
}

function formatProjectStatusLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    active: '运行中',
    running: '运行中',
    initializing: '初始化中',
    pending: '待处理',
    failed: '失败',
    archived: '已归档',
  };

  return value ? (labels[value] ?? value) : '待处理';
}

export function decorateProjectDatabaseCards<
  TDatabase extends ProjectDatabaseLike,
  TService extends ProjectServiceLike,
  TMigrationRun extends ProjectMigrationRunLike,
  TRelease extends ProjectReleaseLike,
  TDeployment extends ProjectDeploymentLike,
>(
  databases: TDatabase[],
  options: {
    services: TService[];
    recentMigrationRuns: TMigrationRun[];
    recentReleases: TRelease[];
    deploymentImageCandidates: TDeployment[];
    manualMigrationCapability?: ProjectGovernanceCapability | null;
  }
): Array<TDatabase & ProjectDatabaseCardDecorations> {
  const serviceNameById = new Map(options.services.map((service) => [service.id, service.name]));

  const latestMigrationByDatabase = new Map<string, TMigrationRun>();
  for (const run of options.recentMigrationRuns) {
    if (!latestMigrationByDatabase.has(run.databaseId)) {
      latestMigrationByDatabase.set(run.databaseId, run);
    }
  }

  const latestImageByScope = new Map<string, string>();
  for (const deployment of options.deploymentImageCandidates) {
    if (!deployment.imageUrl) continue;
    const scopeKey = getScopeKey(deployment.environmentId, deployment.serviceId);
    if (!latestImageByScope.has(scopeKey)) {
      latestImageByScope.set(scopeKey, deployment.imageUrl);
    }
  }

  const latestReleaseByScope = new Map<string, TRelease>();
  for (const release of options.recentReleases) {
    const projectScopeKey = getScopeKey(release.environment.id, null);
    if (!latestReleaseByScope.has(projectScopeKey)) {
      latestReleaseByScope.set(projectScopeKey, release);
    }

    for (const artifact of release.artifacts) {
      const serviceScopeKey = getScopeKey(release.environment.id, artifact.service.id);
      if (!latestReleaseByScope.has(serviceScopeKey)) {
        latestReleaseByScope.set(serviceScopeKey, release);
      }
    }
  }

  return databases.map((database) => {
    const latestMigration = latestMigrationByDatabase.get(database.id) ?? null;
    const serviceScopeKey = getScopeKey(database.environmentId, database.serviceId);
    const projectScopeKey = getScopeKey(database.environmentId, null);
    const latestRelease =
      latestReleaseByScope.get(serviceScopeKey) ??
      latestReleaseByScope.get(projectScopeKey) ??
      null;
    const latestImageUrl =
      latestImageByScope.get(serviceScopeKey) ?? latestImageByScope.get(projectScopeKey) ?? null;

    return {
      ...database,
      serviceName: database.serviceId ? (serviceNameById.get(database.serviceId) ?? null) : null,
      latestMigration: latestMigration
        ? {
            id: latestMigration.id,
            status: latestMigration.status,
            releaseId: latestMigration.releaseId,
          }
        : null,
      latestRelease: latestRelease
        ? {
            id: latestRelease.id,
            title: getReleaseDisplayTitle(latestRelease),
            commitSha: latestRelease.sourceCommitSha,
          }
        : null,
      latestImageUrl,
      manualControl: getDatabaseManualControlSnapshot({
        latestMigration: latestMigration
          ? {
              status: latestMigration.status,
              releaseId: latestMigration.releaseId,
            }
          : null,
        hasLatestRelease: Boolean(latestRelease),
        hasLatestImage: Boolean(latestImageUrl),
      }),
      manualMigrationAction: {
        allowed: options.manualMigrationCapability?.allowed ?? false,
        summary: options.manualMigrationCapability?.summary ?? null,
      },
    };
  });
}

export function decorateProjectAttentionRuns<TRun extends ProjectAttentionRunLike>(
  runs: TRun[]
): Array<TRun & ProjectAttentionItemDecorations> {
  return runs.map((run) => {
    const issueCode = getMigrationAttentionIssueCode(run);
    const issue = buildIssueSnapshot(issueCode);
    const environmentScopeLabel = run.environment
      ? getEnvironmentScopeLabel(run.environment)
      : null;
    const environmentSourceLabel = run.environment
      ? getEnvironmentSourceLabel(run.environment)
      : null;
    const environmentExpiryLabel = formatEnvironmentExpiry(run.environment?.expiresAt);
    const primaryDomainUrl = (() => {
      const primaryDomain = run.environment?.domains?.length
        ? pickPrimaryEnvironmentDomain(run.environment.domains)
        : null;

      return primaryDomain ? buildEnvironmentAccessUrl(primaryDomain.hostname) : null;
    })();
    const previewSourceMeta = buildPreviewSourceMetadata({
      sourceRef: run.release?.sourceRef,
      environment: run.environment,
      reviewRequest: run.previewReviewMetadata ?? null,
    });
    const releaseTitle = run.release ? getReleaseDisplayTitle(run.release) : null;
    const previewLifecycle = run.environment?.isPreview
      ? buildPreviewLifecycleSummary({
          sourceLabel: previewSourceMeta.label ?? environmentSourceLabel,
          expiryLabel: environmentExpiryLabel,
          primaryDomainUrl,
          latestRelease: run.release
            ? {
                id: run.release.id ?? run.releaseId ?? run.id ?? 'release',
                title: releaseTitle ?? '最近发布',
              }
            : null,
        })
      : null;

    return {
      ...run,
      platformSignals: buildPlatformSignalSnapshot({
        issue,
        previewLifecycle,
      }),
      issue,
      issueCode,
      issueLabel: issue?.label ?? getIssueLabel(issueCode),
      actionLabel: issue?.nextActionLabel ?? getReleaseActionLabel(issueCode),
      environmentScopeLabel,
      environmentSourceLabel,
      environmentExpiryLabel,
      primaryDomainUrl,
      releaseTitle,
      previewSourceMeta,
      previewLifecycle,
    };
  });
}

export function buildProjectOverviewStats(input: {
  serviceCount: number;
  databaseCount: number;
  attentionCount: number;
  releaseCount: number;
}): ProjectOverviewStat[] {
  return [
    { label: '服务', value: input.serviceCount },
    { label: '数据库', value: input.databaseCount },
    { label: '待处理', value: input.attentionCount },
    { label: '发布', value: input.releaseCount },
  ];
}

export function decorateProjectRecentReleases<TRelease extends ProjectReleaseLike>(
  releases: TRelease[]
): Array<TRelease & ProjectRecentReleaseDecorations> {
  return releases.map((release) => {
    const title = getReleaseDisplayTitle(release);
    const environmentScopeLabel = getEnvironmentScopeLabel(release.environment);
    const environmentSourceLabel = getEnvironmentSourceLabel(release.environment);
    const environmentExpiryLabel = formatEnvironmentExpiry(release.environment.expiresAt);
    const primaryDomainUrl = (() => {
      const primaryDomain = release.environment.domains?.length
        ? pickPrimaryEnvironmentDomain(release.environment.domains)
        : null;

      return primaryDomain ? buildEnvironmentAccessUrl(primaryDomain.hostname) : null;
    })();
    const previewSourceMeta = buildPreviewSourceMetadata({
      sourceRef: release.sourceRef,
      environment: release.environment,
      reviewRequest: release.previewReviewMetadata ?? null,
    });
    const previewLifecycle = release.environment.isPreview
      ? buildPreviewLifecycleSummary({
          sourceLabel: previewSourceMeta.label ?? environmentSourceLabel,
          expiryLabel: environmentExpiryLabel,
          primaryDomainUrl,
          latestRelease: {
            id: release.id,
            title,
          },
        })
      : null;

    return {
      ...release,
      title,
      shortCommitSha: release.sourceCommitSha ? release.sourceCommitSha.slice(0, 7) : null,
      sourceSummary:
        release.sourceCommitSha || release.sourceRef
          ? `${release.sourceCommitSha?.slice(0, 7) ?? ''} ${release.sourceRef ?? ''}`.trim()
          : null,
      environmentScopeLabel,
      environmentSourceLabel,
      environmentExpiryLabel,
      primaryDomainUrl,
      previewSourceMeta,
      previewLifecycle,
      platformSignals: buildPlatformSignalSnapshot({
        previewLifecycle,
      }),
    };
  });
}

export function buildProjectOverviewDetails(
  teamName: string | null | undefined,
  project: ProjectOverviewProjectLike
): ProjectOverviewDetails {
  return {
    headerDescription: `${teamName ?? '团队'} · ${formatProjectStatusLabel(project.status)}`,
    repository: project.repository
      ? {
          fullName: project.repository.fullName,
          webUrl: project.repository.webUrl ?? null,
        }
      : null,
    productionBranch: project.productionBranch ?? null,
    description: project.description ?? null,
    statusLabel: formatProjectStatusLabel(project.status),
    createdDateLabel: formatPlatformDate(project.createdAt) ?? '—',
  };
}

export function decorateProjectServices<TService extends ProjectServiceLike>(
  services: TService[]
): Array<TService & ProjectServiceDecorations> {
  return services.map((service) => ({
    ...service,
    statusLabel: formatProjectStatusLabel(service.status),
    portLabel: service.port ? `:${service.port}` : null,
  }));
}

export function decorateProjectDomains<TDomain extends ProjectDomainLike>(
  domains: TDomain[]
): Array<TDomain & ProjectDomainDecorations> {
  return domains.map((domain) => ({
    ...domain,
    url: `https://${domain.hostname}`,
  }));
}
