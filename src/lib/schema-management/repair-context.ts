import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, schemaRepairAtlasRuns, schemaRepairPlans } from '@/lib/db/schema';
import type { Capability } from '@/lib/integrations/domain/models';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';

export interface SchemaRepairGeneratedArtifacts {
  files: Record<string, string>;
  generatedFiles: string[];
}

function normalizeSchemaRepairGeneratedArtifacts(
  input:
    | {
        status?: string | null;
        artifactFiles?: unknown;
        generatedFiles?: unknown;
      }
    | null
    | undefined
): SchemaRepairGeneratedArtifacts {
  if (!input || input.status !== 'succeeded') {
    return {
      files: {},
      generatedFiles: [],
    };
  }

  if (!input.artifactFiles || typeof input.artifactFiles !== 'object') {
    return {
      files: {},
      generatedFiles: [],
    };
  }

  const files = input.artifactFiles as Record<string, string>;

  return {
    files,
    generatedFiles: Array.isArray(input.generatedFiles)
      ? (input.generatedFiles as string[])
      : Object.keys(files),
  };
}

async function requireSchemaRepairProject(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  const repository = project?.repository;

  if (!project || !repository) {
    throw new Error('项目缺少仓库绑定');
  }

  return {
    ...project,
    repository,
  };
}

async function requireSchemaRepairPlan(input: { projectId: string; planId: string }) {
  const plan = await db.query.schemaRepairPlans.findFirst({
    where: eq(schemaRepairPlans.id, input.planId),
    with: {
      database: true,
      environment: true,
    },
  });

  if (!plan || plan.projectId !== input.projectId) {
    throw new Error('修复计划不存在');
  }

  return plan;
}

export async function loadSchemaRepairPlanExecutionContext(input: {
  projectId: string;
  planId: string;
}) {
  const [project, plan] = await Promise.all([
    requireSchemaRepairProject(input.projectId),
    requireSchemaRepairPlan(input),
  ]);

  return {
    project,
    plan,
  };
}

export async function loadSchemaRepairAtlasRunExecutionContext(input: {
  projectId: string;
  atlasRunId: string;
}) {
  const run = await db.query.schemaRepairAtlasRuns.findFirst({
    where: eq(schemaRepairAtlasRuns.id, input.atlasRunId),
  });

  if (!run || run.projectId !== input.projectId) {
    throw new Error('Atlas 执行记录不存在');
  }

  const context = await loadSchemaRepairPlanExecutionContext({
    projectId: input.projectId,
    planId: run.planId,
  });

  return {
    ...context,
    run,
  };
}

export async function loadLatestSchemaRepairGeneratedArtifacts(
  planId: string
): Promise<SchemaRepairGeneratedArtifacts> {
  const latestRun = await db.query.schemaRepairAtlasRuns.findFirst({
    where: eq(schemaRepairAtlasRuns.planId, planId),
    orderBy: [desc(schemaRepairAtlasRuns.createdAt)],
  });

  return normalizeSchemaRepairGeneratedArtifacts(latestRun);
}

export async function requireSchemaRepairRepositorySession(input: {
  teamId: string;
  userId?: string | null;
  requiredCapabilities: Capability[];
}) {
  return getTeamIntegrationSession({
    teamId: input.teamId,
    actingUserId: input.userId ?? null,
    requiredCapabilities: input.requiredCapabilities,
  });
}
