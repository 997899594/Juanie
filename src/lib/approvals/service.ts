import {
  type ApprovalRunLike,
  buildApprovalStats,
  decorateApprovalRuns,
} from '@/lib/approvals/view';
import { db } from '@/lib/db';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import {
  type AttentionFilterState,
  filterAttentionRuns,
  getAttentionStats,
} from '@/lib/migrations/attention';

export function buildApprovalsPageData<TRun extends ApprovalRunLike>(input: {
  runs: TRun[];
  filterState: AttentionFilterState;
}) {
  const attentionRuns = filterAttentionRuns(input.runs);
  const filteredRuns = filterAttentionRuns(attentionRuns, input.filterState);
  const attentionStats = getAttentionStats(attentionRuns);

  return {
    stats: buildApprovalStats(attentionStats),
    attentionRuns: decorateApprovalRuns(filteredRuns),
  };
}

export type ApprovalsPageData = ReturnType<typeof buildApprovalsPageData>;

export async function getApprovalsPageData(input: {
  teamIds: string[];
  filterState: AttentionFilterState;
}) {
  const visibleProjects =
    input.teamIds.length > 0
      ? await db.query.projects.findMany({
          where: (project, { inArray }) => inArray(project.teamId, input.teamIds),
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
  const projectIds = visibleProjects.map((project) => project.id);

  const runs =
    projectIds.length > 0
      ? await db.query.migrationRuns.findMany({
          where: (run, { inArray }) => inArray(run.projectId, projectIds),
          orderBy: (run, { desc }) => [desc(run.createdAt)],
          with: {
            database: true,
            environment: {
              with: {
                domains: true,
              },
            },
            service: true,
            project: true,
            specification: true,
            release: {
              with: {
                artifacts: true,
              },
            },
          },
        })
      : [];

  const previewReviewMetadataById = await buildPreviewReviewMetadataByItemId({
    projects: visibleProjects,
    items: runs.map((run) => ({
      id: run.id,
      projectId: run.projectId,
      sourceRef: run.release?.sourceRef ?? null,
      environment: run.environment,
    })),
  });

  return buildApprovalsPageData({
    runs: runs.map((run) => ({
      ...run,
      previewReviewMetadata: previewReviewMetadataById.get(run.id) ?? null,
    })),
    filterState: input.filterState,
  });
}
