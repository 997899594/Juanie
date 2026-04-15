import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import { type EnvironmentKindLike, isPreviewEnvironment } from '@/lib/environments/model';
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
import type { PlatformSignalSnapshot } from '@/lib/signals/platform';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';

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
  environment?:
    | (EnvironmentKindLike & {
        name?: string | null;
        previewPrNumber?: number | null;
        branch?: string | null;
        expiresAt?: Date | string | null;
        domains?: Array<{
          id: string;
          hostname: string;
          isCustom?: boolean | null;
          isVerified?: boolean | null;
        }> | null;
      })
    | null;
  release?: {
    id?: string;
    summary?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    environment?: EnvironmentKindLike | null;
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
  environment: EnvironmentKindLike & {
    id: string;
    name?: string;
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

export function getScopeKey(environmentId?: string | null, serviceId?: string | null): string {
  return `${environmentId ?? 'global'}:${serviceId ?? 'project'}`;
}

export function buildProjectEnvironmentPresentation(input: {
  environment:
    | ProjectAttentionRunLike['environment']
    | ProjectReleaseLike['environment']
    | null
    | undefined;
  sourceRef?: string | null;
  reviewRequest?: PreviewReviewMetadata | null;
  releaseTitle?: string | null;
  releaseId?: string | null;
}) {
  const environmentScopeLabel = input.environment
    ? getEnvironmentScopeLabel(input.environment)
    : null;
  const environmentSourceLabel = input.environment
    ? getEnvironmentSourceLabel(input.environment)
    : null;
  const environmentExpiryLabel = formatEnvironmentExpiry(input.environment?.expiresAt);
  const primaryDomain = input.environment?.domains?.length
    ? pickPrimaryEnvironmentDomain(input.environment.domains)
    : null;
  const primaryDomainUrl = primaryDomain ? buildEnvironmentAccessUrl(primaryDomain.hostname) : null;
  const previewSourceMeta = buildPreviewSourceMetadata({
    sourceRef: input.sourceRef,
    environment: input.environment,
    reviewRequest: input.reviewRequest ?? null,
  });
  const previewLifecycle =
    input.environment && isPreviewEnvironment(input.environment)
      ? buildPreviewLifecycleSummary({
          sourceLabel: previewSourceMeta.label ?? environmentSourceLabel,
          expiryLabel: environmentExpiryLabel,
          primaryDomainUrl,
          latestRelease:
            input.releaseId && input.releaseTitle
              ? {
                  id: input.releaseId,
                  title: input.releaseTitle,
                }
              : null,
        })
      : null;

  return {
    environmentScopeLabel,
    environmentSourceLabel,
    environmentExpiryLabel,
    primaryDomainUrl,
    previewSourceMeta,
    previewLifecycle,
  };
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
    const releaseTitle = run.release ? getReleaseDisplayTitle(run.release) : null;
    const environmentPresentation = buildProjectEnvironmentPresentation({
      environment: run.environment,
      sourceRef: run.release?.sourceRef,
      reviewRequest: run.previewReviewMetadata ?? null,
      releaseTitle: releaseTitle ?? '最近发布',
      releaseId: run.release?.id ?? run.releaseId ?? run.id ?? 'release',
    });

    return {
      ...run,
      platformSignals: buildPlatformSignalSnapshot({
        issue,
        previewLifecycle: environmentPresentation.previewLifecycle,
      }),
      issue,
      issueCode,
      issueLabel: issue?.label ?? getIssueLabel(issueCode),
      actionLabel: issue?.nextActionLabel ?? getReleaseActionLabel(issueCode),
      environmentScopeLabel: environmentPresentation.environmentScopeLabel,
      environmentSourceLabel: environmentPresentation.environmentSourceLabel,
      environmentExpiryLabel: environmentPresentation.environmentExpiryLabel,
      primaryDomainUrl: environmentPresentation.primaryDomainUrl,
      releaseTitle,
      previewSourceMeta: environmentPresentation.previewSourceMeta,
      previewLifecycle: environmentPresentation.previewLifecycle,
    };
  });
}
