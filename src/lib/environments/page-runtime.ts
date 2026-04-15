import { buildEnvironmentRecentActivity } from '@/lib/environments/activity';
import { isActivePreviewReleaseStatus } from '@/lib/environments/cleanup';

export function buildEnvironmentRuntimeIndexes<
  TRelease extends { environmentId: string; status: string },
  TDeployment extends { environmentId: string },
  TMigrationRun extends { environmentId: string },
>(input: { releases: TRelease[]; deployments: TDeployment[]; migrationRuns: TMigrationRun[] }) {
  const latestReleaseByEnvironment = new Map<string, TRelease>();
  const activeReleaseCountByEnvironment = new Map<string, number>();
  const latestDeploymentByEnvironment = new Map<string, TDeployment>();
  const latestMigrationByEnvironment = new Map<string, TMigrationRun>();

  for (const release of input.releases) {
    if (!latestReleaseByEnvironment.has(release.environmentId)) {
      latestReleaseByEnvironment.set(release.environmentId, release);
    }

    if (isActivePreviewReleaseStatus(release.status)) {
      activeReleaseCountByEnvironment.set(
        release.environmentId,
        (activeReleaseCountByEnvironment.get(release.environmentId) ?? 0) + 1
      );
    }
  }

  for (const deployment of input.deployments) {
    if (!latestDeploymentByEnvironment.has(deployment.environmentId)) {
      latestDeploymentByEnvironment.set(deployment.environmentId, deployment);
    }
  }

  for (const run of input.migrationRuns) {
    if (!latestMigrationByEnvironment.has(run.environmentId)) {
      latestMigrationByEnvironment.set(run.environmentId, run);
    }
  }

  return {
    latestReleaseByEnvironment,
    activeReleaseCountByEnvironment,
    latestDeploymentByEnvironment,
    latestMigrationByEnvironment,
  };
}

export function attachEnvironmentRecentActivity<
  TEnvironment extends {
    id: string;
    branch?: string | null;
    previewPrNumber?: number | null;
    latestRelease?: {
      id: string;
      status: string;
      sourceRef?: string | null;
      createdAt?: Date | string;
    } | null;
    previewBuildStatus?: string | null;
    previewBuildSourceCommitSha?: string | null;
    previewBuildStartedAt?: Date | string | null;
    latestReleaseCard?: {
      title?: string | null;
      shortCommitSha?: string | null;
    } | null;
    latestDeployment?: {
      id: string;
      status: string;
      createdAt?: Date | string;
      releaseId?: string | null;
      service?: {
        name?: string | null;
      } | null;
    } | null;
    latestMigrationRun?: {
      id: string;
      status: string;
      createdAt?: Date | string;
      releaseId?: string | null;
      service?: {
        name?: string | null;
      } | null;
      database?: {
        name?: string | null;
      } | null;
    } | null;
    latestGovernanceEvent?: {
      key: string;
      label: string;
      summary: string;
      createdAt: Date;
    } | null;
  },
>(projectId: string, environments: TEnvironment[]) {
  return environments.map((environment) => ({
    ...environment,
    recentActivity: buildEnvironmentRecentActivity({
      projectId,
      environmentId: environment.id,
      latestRelease: environment.latestRelease
        ? {
            id: environment.latestRelease.id,
            status: environment.latestRelease.status,
            title:
              environment.latestReleaseCard?.title ??
              environment.latestRelease.sourceRef ??
              '最近发布',
            shortCommitSha: environment.latestReleaseCard?.shortCommitSha ?? null,
            createdAt: environment.latestRelease.createdAt,
          }
        : null,
      latestDeployment: environment.latestDeployment
        ? {
            id: environment.latestDeployment.id,
            status: environment.latestDeployment.status,
            serviceName: environment.latestDeployment.service?.name ?? null,
            createdAt: environment.latestDeployment.createdAt,
            releaseId: environment.latestDeployment.releaseId ?? null,
          }
        : null,
      latestPreviewBuild: environment.previewBuildStatus
        ? {
            status: environment.previewBuildStatus,
            sourceLabel: environment.previewPrNumber
              ? `PR #${environment.previewPrNumber}`
              : environment.branch
                ? `分支 ${environment.branch}`
                : null,
            shortCommitSha: environment.previewBuildSourceCommitSha?.slice(0, 7) ?? null,
            createdAt: environment.previewBuildStartedAt,
          }
        : null,
      latestMigration: environment.latestMigrationRun
        ? {
            id: environment.latestMigrationRun.id,
            status: environment.latestMigrationRun.status,
            serviceName: environment.latestMigrationRun.service?.name ?? null,
            databaseName: environment.latestMigrationRun.database?.name ?? null,
            createdAt: environment.latestMigrationRun.createdAt,
            releaseId: environment.latestMigrationRun.releaseId ?? null,
          }
        : null,
      latestGovernance: environment.latestGovernanceEvent
        ? {
            key: environment.latestGovernanceEvent.key,
            label: environment.latestGovernanceEvent.label,
            summary: environment.latestGovernanceEvent.summary,
            createdAt: environment.latestGovernanceEvent.createdAt,
          }
        : null,
    }),
  }));
}
