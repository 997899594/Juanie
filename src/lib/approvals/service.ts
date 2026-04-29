import { createMigrationApprovalToken } from '@/lib/ai/runtime/approval-token';
import {
  type ApprovalRunLike,
  buildApprovalStats,
  decorateApprovalRuns,
} from '@/lib/approvals/view';
import { db } from '@/lib/db';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import {
  type AttentionFilterState,
  attentionMigrationStatuses,
  filterAttentionRuns,
  getAttentionStats,
} from '@/lib/migrations/attention';
import { buildMigrationFilePreviewByRunId } from '@/lib/migrations/file-preview';

export function buildApprovalsPageData<TRun extends ApprovalRunLike>(input: {
  runs: TRun[];
  filterState: AttentionFilterState;
}) {
  const activeAttentionRuns = filterAttentionRuns(input.runs);
  const filteredRuns =
    input.filterState === 'all'
      ? activeAttentionRuns
      : filterAttentionRuns(input.runs, input.filterState);
  const attentionStats = getAttentionStats(input.runs);

  return {
    stats: buildApprovalStats(attentionStats),
    attentionRuns: decorateApprovalRuns(filteredRuns),
  };
}

export type ApprovalsPageData = ReturnType<typeof buildApprovalsPageData>;

export async function getApprovalsPageData(input: {
  teamIds: string[];
  filterState: AttentionFilterState;
  actorUserId?: string | null;
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

  const runsNeedingPreview = runs.filter(
    (run) =>
      attentionMigrationStatuses.includes(
        run.status as (typeof attentionMigrationStatuses)[number]
      ) && run.specification !== null
  );
  const filePreviewByRunId = await buildMigrationFilePreviewByRunId(
    runsNeedingPreview.map((run) => ({
      id: run.id,
      projectId: run.projectId,
      specification: run.specification
        ? {
            tool: run.specification.tool,
            migrationPath: run.specification.migrationPath,
            sourceConfigPath: run.specification.sourceConfigPath,
          }
        : null,
      database: run.database
        ? {
            id: run.database.id,
            type: run.database.type,
            connectionString: run.database.connectionString,
          }
        : null,
      status: run.status,
      release: run.release
        ? {
            sourceRef: run.release.sourceRef,
            sourceCommitSha: run.release.sourceCommitSha,
          }
        : null,
      environment: run.environment
        ? {
            branch: run.environment.branch,
          }
        : null,
    })),
    {
      executionStateMode: 'run_status',
    }
  );

  const data = buildApprovalsPageData({
    runs: runs.map((run) => ({
      ...run,
      specification:
        run.specification && filePreviewByRunId.has(run.id)
          ? {
              ...run.specification,
              filePreview: filePreviewByRunId.get(run.id) ?? null,
            }
          : run.specification,
      previewReviewMetadata: previewReviewMetadataById.get(run.id) ?? null,
    })),
    filterState: input.filterState,
  });

  return {
    ...data,
    attentionRuns: data.attentionRuns.map((run) => ({
      ...run,
      approvalToken:
        run.status === 'awaiting_approval' && input.actorUserId
          ? createMigrationApprovalToken({
              teamId: run.project.teamId,
              projectId: run.projectId,
              environmentId: run.environment.id,
              runId: run.id,
              actorUserId: input.actorUserId,
            })
          : null,
    })),
  };
}
