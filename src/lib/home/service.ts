import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, teamMembers } from '@/lib/db/schema';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import {
  buildHomeCommandCenter,
  buildHomeStats,
  decorateHomeAttentionRuns,
  decorateHomeProjects,
} from '@/lib/home/view';
import { filterAttentionRuns, getAttentionStats } from '@/lib/migrations/attention';

const homeAttentionStatuses = [
  'awaiting_approval',
  'awaiting_external_completion',
  'failed',
] as const;

type HomeAttentionStatus = (typeof homeAttentionStatuses)[number];

function isHomeAttentionStatus(status: string): status is HomeAttentionStatus {
  return homeAttentionStatuses.includes(status as HomeAttentionStatus);
}

export function buildHomePageData<
  TTeamMember extends { teamId: string; role: 'owner' | 'admin' | 'member' },
  TProject extends {
    id: string;
    name: string;
    teamId: string;
    status?: string | null;
    repository?: { fullName?: string | null } | null;
    environments?: Array<{
      id: string;
      name: string;
      isProduction?: boolean | null;
      isPreview?: boolean | null;
    }>;
  },
  TAttentionRun extends {
    id: string;
    projectId: string;
    releaseId?: string | null;
    status: string;
    createdAt?: Date | string | null;
    database?: { name?: string | null } | null;
    project?: { name?: string | null } | null;
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
      id: string;
      summary?: string | null;
      sourceRef?: string | null;
      sourceCommitSha?: string | null;
      environment?: {
        isPreview?: boolean | null;
      } | null;
    } | null;
  },
>(input: {
  userName?: string | null;
  userTeams: TTeamMember[];
  userProjects: TProject[];
  attentionRuns: TAttentionRun[];
}) {
  const attentionRuns = filterAttentionRuns(
    input.attentionRuns.filter((run) => isHomeAttentionStatus(run.status))
  );
  const attentionStats = getAttentionStats(attentionRuns);
  const rolesByTeamId = new Map(
    input.userTeams.map((membership) => [membership.teamId, membership.role])
  );
  const projectCards = decorateHomeProjects(input.userProjects, { rolesByTeamId });
  const attentionItems = decorateHomeAttentionRuns(attentionRuns);
  const activeProjectCount = input.userProjects.filter(
    (project) => project.status === 'active' || project.status === 'running'
  ).length;

  return {
    headerDescription: input.userName || '控制台',
    stats: buildHomeStats({
      projectCount: input.userProjects.length,
      teamCount: input.userTeams.length,
      attentionCount: attentionStats.total,
      activeProjectCount,
    }),
    commandCenter: buildHomeCommandCenter({
      projectCards,
      attentionItems,
    }),
    projectCards,
    attentionItems,
  };
}

export type HomePageData = ReturnType<typeof buildHomePageData>;

export async function getHomePageData(userId: string, userName?: string | null) {
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: true,
    },
  });

  const teamIds = userTeams.map((tm) => tm.teamId);
  const visibleProjects =
    teamIds.length > 0
      ? await db.query.projects.findMany({
          where: (project, { inArray }) => inArray(project.teamId, teamIds),
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
        })
      : [];
  const teamProjectIds = visibleProjects.map((project) => project.id);

  const userProjects =
    teamIds.length > 0
      ? await db.query.projects.findMany({
          where: (project, { inArray }) => inArray(project.teamId, teamIds),
          limit: 5,
          orderBy: [desc(projects.createdAt)],
          with: {
            environments: true,
            repository: true,
          },
        })
      : [];

  const attentionRuns =
    teamProjectIds.length > 0
      ? await db.query.migrationRuns.findMany({
          where: (run) =>
            and(
              inArray(run.projectId, teamProjectIds),
              inArray(run.status, [...homeAttentionStatuses])
            ),
          orderBy: (run, { desc }) => [desc(run.createdAt)],
          limit: 5,
          with: {
            database: true,
            environment: {
              with: {
                domains: true,
              },
            },
            project: true,
            release: {
              with: {
                environment: true,
              },
            },
          },
        })
      : [];

  const previewReviewMetadataById = await buildPreviewReviewMetadataByItemId({
    projects: visibleProjects,
    items: attentionRuns.map((run) => ({
      id: run.id,
      projectId: run.projectId,
      sourceRef: run.release?.sourceRef ?? null,
      environment: run.environment,
    })),
  });

  return buildHomePageData({
    userName,
    userTeams,
    userProjects,
    attentionRuns: attentionRuns.map((run) => ({
      ...run,
      previewReviewMetadata: previewReviewMetadataById.get(run.id) ?? null,
    })),
  });
}
