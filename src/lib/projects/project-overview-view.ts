import type {
  ProjectDomainDecorations,
  ProjectDomainLike,
  ProjectOverviewDetails,
  ProjectOverviewProjectLike,
  ProjectOverviewStat,
  ProjectRecentReleaseDecorations,
  ProjectReleaseLike,
  ProjectServiceDecorations,
  ProjectServiceLike,
} from '@/lib/projects/project-view-shared';
import { buildProjectEnvironmentPresentation } from '@/lib/projects/project-view-shared';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { formatRuntimeStatusLabel } from '@/lib/runtime/status-presentation';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformDate } from '@/lib/time/format';

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
    const environmentPresentation = buildProjectEnvironmentPresentation({
      environment: release.environment,
      sourceRef: release.sourceRef,
      reviewRequest: release.previewReviewMetadata ?? null,
      releaseTitle: title,
      releaseId: release.id,
    });

    return {
      ...release,
      title,
      shortCommitSha: release.sourceCommitSha ? release.sourceCommitSha.slice(0, 7) : null,
      sourceSummary:
        release.sourceCommitSha || release.sourceRef
          ? `${release.sourceCommitSha?.slice(0, 7) ?? ''} ${release.sourceRef ?? ''}`.trim()
          : null,
      environmentScopeLabel: environmentPresentation.environmentScopeLabel,
      environmentSourceLabel: environmentPresentation.environmentSourceLabel,
      environmentExpiryLabel: environmentPresentation.environmentExpiryLabel,
      primaryDomainUrl: environmentPresentation.primaryDomainUrl,
      previewSourceMeta: environmentPresentation.previewSourceMeta,
      previewLifecycle: environmentPresentation.previewLifecycle,
      platformSignals: buildPlatformSignalSnapshot({
        previewLifecycle: environmentPresentation.previewLifecycle,
      }),
    };
  });
}

export function buildProjectOverviewDetails(
  teamName: string | null | undefined,
  project: ProjectOverviewProjectLike
): ProjectOverviewDetails {
  return {
    headerDescription: `${teamName ?? '团队'} · ${formatRuntimeStatusLabel(project.status)}`,
    repository: project.repository
      ? {
          fullName: project.repository.fullName,
          webUrl: project.repository.webUrl ?? null,
        }
      : null,
    productionBranch: project.productionBranch ?? null,
    description: project.description ?? null,
    statusLabel: formatRuntimeStatusLabel(project.status),
    createdDateLabel: formatPlatformDate(project.createdAt) ?? '—',
  };
}

export function decorateProjectServices<TService extends ProjectServiceLike>(
  services: TService[]
): Array<TService & ProjectServiceDecorations> {
  return services.map((service) => ({
    ...service,
    statusLabel: formatRuntimeStatusLabel(service.status),
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
