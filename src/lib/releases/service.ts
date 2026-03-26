import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, projects, releases, type TeamRole } from '@/lib/db/schema';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import { getPreviousReleaseByScope, getReleaseById } from '@/lib/releases';
import {
  buildReleaseEnvironmentActionSnapshot,
  buildReleasePageGovernanceSnapshot,
} from '@/lib/releases/governance-view';
import { buildPromotionPlan } from '@/lib/releases/planning';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import {
  buildReleaseListStats,
  decorateReleaseDetail,
  decorateReleaseList,
  filterReleaseCards,
  normalizeReleaseRiskFilterState,
} from '@/lib/releases/view';

export function buildProjectReleaseListData<
  TRelease extends Parameters<typeof decorateReleaseList>[0][number],
>(releases: TRelease[]) {
  return decorateReleaseList(releases);
}

export async function getProjectReleaseListData(projectId: string) {
  const [project, releaseList] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: {
        id: true,
        teamId: true,
      },
      with: {
        repository: {
          columns: {
            fullName: true,
            providerId: true,
          },
        },
      },
    }),
    db.query.releases.findMany({
      where: eq(releases.projectId, projectId),
      orderBy: [desc(releases.createdAt)],
      with: {
        environment: {
          with: {
            baseEnvironment: {
              columns: {
                id: true,
                name: true,
              },
            },
            domains: {
              with: {
                service: true,
              },
            },
            databases: {
              columns: {
                id: true,
                name: true,
                status: true,
                sourceDatabaseId: true,
              },
            },
          },
        },
        artifacts: {
          with: {
            service: true,
          },
        },
        deployments: {
          with: {
            service: true,
          },
        },
        migrationRuns: {
          with: {
            service: true,
            database: true,
            specification: true,
          },
        },
      },
    }),
  ]);

  const previewReviewMetadataById = project
    ? await buildPreviewReviewMetadataByItemId({
        projects: [project],
        items: releaseList.map((release) => ({
          id: release.id,
          projectId: release.projectId,
          sourceRef: release.sourceRef,
          environment: release.environment,
        })),
      })
    : new Map();

  return buildProjectReleaseListData(
    releaseList.map((release) => ({
      ...release,
      previewReviewMetadata: previewReviewMetadataById.get(release.id) ?? null,
    }))
  );
}

export function buildProjectReleasesPageData<
  TRelease extends ReturnType<typeof buildProjectReleaseListData>[number] & {
    status: string;
    environment: {
      id: string;
      name?: string;
      isProduction?: boolean | null;
    };
  },
  TEnvironment extends {
    id: string;
    name: string;
    autoDeploy: boolean;
    isProduction: boolean;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
  },
  TPromotePlan,
>(input: {
  releases: TRelease[];
  environments: TEnvironment[];
  role: TeamRole;
  promotePlan: TPromotePlan | null;
  envFilter?: string | null;
  riskFilter?: string | null;
}) {
  const governance = buildReleasePageGovernanceSnapshot({
    role: input.role,
    environments: input.environments,
  });
  const releases = input.releases.map((release) => ({
    ...release,
    actions: buildReleaseEnvironmentActionSnapshot(input.role, release.environment),
  }));
  const selectedEnv = input.envFilter && input.envFilter.length > 0 ? input.envFilter : 'all';
  const selectedRisk = normalizeReleaseRiskFilterState(input.riskFilter);
  const filteredReleases = filterReleaseCards(releases, {
    env: selectedEnv,
    risk: selectedRisk,
  });

  return {
    releases,
    filteredReleases,
    environments: input.environments,
    governance,
    environmentOptions: [
      'all',
      ...new Set(releases.map((release) => release.environment.name ?? '环境')),
    ],
    selectedEnv,
    selectedRisk,
    stats: [...buildReleaseListStats(filteredReleases), { label: '实时', value: '离线' as const }],
    promotePlan: input.promotePlan,
    hasStagingProdSplit: input.environments.some((environment) => environment.isProduction),
  };
}

export async function getProjectReleasesPageData(input: {
  projectId: string;
  role: TeamRole;
  envFilter?: string | null;
  riskFilter?: string | null;
}) {
  const [releaseCards, environmentList, promotePlan] = await Promise.all([
    getProjectReleaseListData(input.projectId),
    db.query.environments.findMany({
      where: eq(environments.projectId, input.projectId),
      orderBy: [environments.createdAt],
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
          },
        },
        databases: {
          columns: {
            id: true,
            name: true,
            status: true,
            sourceDatabaseId: true,
          },
        },
      },
    }),
    buildPromotionPlan(input.projectId).catch(() => null),
  ]);

  return buildProjectReleasesPageData({
    releases: releaseCards,
    environments: environmentList,
    role: input.role,
    promotePlan,
    envFilter: input.envFilter,
    riskFilter: input.riskFilter,
  });
}

export function buildReleaseDetailPageData<
  TRelease extends Parameters<typeof decorateReleaseDetail>[0] & {
    projectId: string;
    environmentId: string;
    createdAt: Date;
  },
  TPreviousRelease extends
    | (Parameters<typeof decorateReleaseDetail>[1] & {
        id: string;
        summary?: string | null;
        sourceRef?: string | null;
        sourceCommitSha?: string | null;
        environment?: {
          isPreview?: boolean | null;
        } | null;
      })
    | null,
>(input: { projectId: string; release: TRelease; previousRelease: TPreviousRelease }) {
  if (input.release.projectId !== input.projectId) {
    return null;
  }

  return {
    release: decorateReleaseDetail(input.release, input.previousRelease ?? null),
    previousReleaseLink: input.previousRelease
      ? {
          id: input.previousRelease.id,
          title: getReleaseDisplayTitle(input.previousRelease),
        }
      : null,
  };
}

export async function getReleaseDetailPageData(input: { projectId: string; releaseId: string }) {
  const release = await getReleaseById(input.releaseId);
  if (!release) {
    return null;
  }

  const previousRelease = await getPreviousReleaseByScope({
    projectId: input.projectId,
    environmentId: release.environmentId,
    createdAt: release.createdAt,
  });

  const previewReviewMetadataById = await buildPreviewReviewMetadataByItemId({
    projects: [
      {
        id: release.project.id,
        teamId: release.project.teamId,
        repository: release.project.repository
          ? {
              fullName: release.project.repository.fullName,
              providerId: release.project.repository.providerId,
            }
          : null,
      },
    ],
    items: [
      {
        id: release.id,
        projectId: release.projectId,
        sourceRef: release.sourceRef,
        environment: release.environment,
      },
      ...(previousRelease
        ? [
            {
              id: previousRelease.id,
              projectId: input.projectId,
              sourceRef: previousRelease.sourceRef,
              environment: null,
            },
          ]
        : []),
    ],
  });

  return buildReleaseDetailPageData({
    projectId: input.projectId,
    release: {
      ...release,
      previewReviewMetadata: previewReviewMetadataById.get(release.id) ?? null,
    },
    previousRelease: previousRelease ?? null,
  });
}
