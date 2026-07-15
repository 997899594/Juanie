import {
  createMigrationApprovalToken,
  createReleaseMigrationPlanApprovalToken,
} from '@/lib/ai/runtime/approval-token';
import { type ApprovalRunLike, decorateApprovalRuns } from '@/lib/approvals/view';
import { db } from '@/lib/db';
import { buildPreviewReviewMetadataByItemId } from '@/lib/environments/review-metadata';
import {
  decorateSchemaAttentionDatabases,
  isSchemaAttentionDatabase,
  type SchemaAttentionDatabaseLike,
} from '@/lib/inbox/schema-attention';
import { buildInboxStats, type InboxFilterState } from '@/lib/inbox/view';
import {
  attentionMigrationStatuses,
  filterAttentionRuns,
  getAttentionStats,
} from '@/lib/migrations/attention';
import { buildMigrationFilePreviewByRunId } from '@/lib/migrations/file-preview';

function isResolvedBySchemaState(run: ApprovalRunLike): boolean {
  return run.status === 'failed' && run.database.schemaState?.status === 'aligned';
}

function isSchemaBlocking(status: string): boolean {
  return status !== 'pending_migrations';
}

export function buildInboxPageData<
  TRun extends ApprovalRunLike,
  TDatabase extends SchemaAttentionDatabaseLike,
>(input: {
  migrationRuns: TRun[];
  migrationPlans?: Array<{
    id: string;
    releaseId: string;
    projectId: string;
    environmentId: string;
    sourceCommitSha: string;
    digest: string;
    stageCount: number;
    projectName: string;
    environmentName: string;
    approvalToken?: string | null;
  }>;
  schemaDatabases: TDatabase[];
  filterState: InboxFilterState;
}) {
  const migrationPlans = input.migrationPlans ?? [];
  const unresolvedRuns = input.migrationRuns.filter((run) => !isResolvedBySchemaState(run));
  const migrationAttentionRuns = filterAttentionRuns(unresolvedRuns);
  const migrationStats = getAttentionStats(unresolvedRuns);
  const schemaItems = decorateSchemaAttentionDatabases(
    input.schemaDatabases.filter(
      (database) => database.schemaState && isSchemaAttentionDatabase(database)
    )
  );
  const filteredMigrationRuns =
    input.filterState === 'schema'
      ? []
      : input.filterState === 'all'
        ? migrationAttentionRuns
        : filterAttentionRuns(unresolvedRuns, input.filterState);
  const filteredSchemaItems =
    input.filterState === 'all' || input.filterState === 'schema' ? schemaItems : [];
  const stats = buildInboxStats({
    migrationTotal: migrationStats.total + migrationPlans.length,
    approval: migrationStats.approval + migrationPlans.length,
    external: migrationStats.external,
    failed: migrationStats.failed,
    schema: schemaItems.length,
    schemaBlocking: schemaItems.filter((item) => isSchemaBlocking(item.status)).length,
  });

  return {
    stats,
    migrationPlans:
      input.filterState === 'all' || input.filterState === 'approval' ? migrationPlans : [],
    attentionRuns: decorateApprovalRuns(filteredMigrationRuns),
    schemaItems: filteredSchemaItems,
  };
}

export type InboxPageData = ReturnType<typeof buildInboxPageData>;

export async function getInboxPageData(input: {
  teamIds: string[];
  filterState: InboxFilterState;
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

  const [runs, schemaDatabases, migrationPlans] =
    projectIds.length > 0
      ? await Promise.all([
          db.query.migrationRuns.findMany({
            where: (run, { inArray }) => inArray(run.projectId, projectIds),
            orderBy: (run, { desc }) => [desc(run.createdAt)],
            with: {
              database: {
                with: {
                  schemaState: true,
                },
              },
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
          }),
          db.query.databases.findMany({
            where: (database, { inArray }) => inArray(database.projectId, projectIds),
            orderBy: (database, { desc }) => [desc(database.updatedAt)],
            with: {
              project: true,
              environment: true,
              service: true,
              schemaState: true,
            },
          }),
          db.query.releaseMigrationPlans.findMany({
            where: (plan, { and, eq, inArray }) =>
              and(inArray(plan.projectId, projectIds), eq(plan.status, 'awaiting_approval')),
            orderBy: (plan, { desc }) => [desc(plan.createdAt)],
            with: {
              project: true,
              environment: true,
              release: true,
            },
          }),
        ])
      : [[], [], []];

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
            capabilities: run.database.capabilities,
          }
        : null,
      status: run.status,
      filePreview: run.filePreview,
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
      includeFileDetails: true,
    }
  );

  const data = buildInboxPageData({
    migrationRuns: runs.map((run) => ({
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
    migrationPlans: migrationPlans.map((plan) => ({
      id: plan.id,
      releaseId: plan.releaseId,
      projectId: plan.projectId,
      environmentId: plan.environmentId,
      sourceCommitSha: plan.sourceCommitSha,
      digest: plan.digest,
      stageCount: plan.snapshot.stages.length,
      projectName: plan.project.name,
      environmentName: plan.environment.name,
      approvalToken: input.actorUserId
        ? createReleaseMigrationPlanApprovalToken({
            teamId: plan.project.teamId,
            projectId: plan.projectId,
            environmentId: plan.environmentId,
            releaseId: plan.releaseId,
            planId: plan.id,
            digest: plan.digest,
            actorUserId: input.actorUserId,
          })
        : null,
    })),
    schemaDatabases,
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
