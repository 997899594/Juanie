import {
  buildEnvironmentEnvvarRiskEvidence,
  type EnvironmentEnvvarRiskEvidence,
} from '@/lib/ai/evidence/environment-envvar-risk';
import {
  buildEnvironmentEvidencePack,
  type EnvironmentEvidencePack,
} from '@/lib/ai/evidence/environment-evidence';
import {
  buildEnvironmentMigrationReviewEvidence,
  type EnvironmentMigrationReviewEvidence,
} from '@/lib/ai/evidence/environment-migration-review';
import {
  buildIncidentEvidencePack,
  type IncidentEvidencePack,
} from '@/lib/ai/evidence/incident-evidence';
import {
  buildReleaseEvidencePack,
  type ReleaseEvidencePack,
} from '@/lib/ai/evidence/release-evidence';
import { recordAIToolTrace } from '@/lib/ai/runtime/tool-trace';
import { getJuanieToolById } from '@/lib/ai/tools/registry';
import type { JuanieToolDefinition } from '@/lib/ai/tools/types';
import { createAuditLog } from '@/lib/audit';
import {
  approveMigrationRunForActor,
  type MigrationRunActionResult,
} from '@/lib/migrations/actions';

export interface JuanieToolExecutionContext {
  actorUserId?: string | null;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  releaseId?: string;
  migrationRunId?: string;
  approvalToken?: string | null;
  reason?: string | null;
}

interface ToolHandlerArgs {
  tool: JuanieToolDefinition;
  context: JuanieToolExecutionContext;
}

export type JuanieToolOutput =
  | EnvironmentEvidencePack
  | EnvironmentMigrationReviewEvidence
  | EnvironmentEnvvarRiskEvidence
  | ReleaseEvidencePack
  | IncidentEvidencePack
  | MigrationRunActionResult;

export interface JuanieToolOutputMap {
  'read-environment-context': EnvironmentEvidencePack;
  'read-environment-variables': EnvironmentEnvvarRiskEvidence;
  'read-environment-migrations': EnvironmentMigrationReviewEvidence;
  'read-environment-schema': EnvironmentEvidencePack;
  'approve-migration-run': MigrationRunActionResult;
  'read-release-context': ReleaseEvidencePack;
  'read-incident-context': IncidentEvidencePack;
}

export type JuanieToolId = keyof JuanieToolOutputMap;

async function executeReadEnvironmentContext({
  context,
}: ToolHandlerArgs): Promise<EnvironmentEvidencePack> {
  if (!context.projectId || !context.environmentId) {
    throw new Error('read-environment-context requires projectId and environmentId');
  }

  return buildEnvironmentEvidencePack({
    projectId: context.projectId,
    environmentId: context.environmentId,
  });
}

async function executeReadEnvironmentVariables({
  context,
}: ToolHandlerArgs): Promise<EnvironmentEnvvarRiskEvidence> {
  if (!context.projectId || !context.environmentId) {
    throw new Error('read-environment-variables requires projectId and environmentId');
  }

  return buildEnvironmentEnvvarRiskEvidence({
    projectId: context.projectId,
    environmentId: context.environmentId,
  });
}

async function executeReadEnvironmentMigrations({
  context,
}: ToolHandlerArgs): Promise<EnvironmentMigrationReviewEvidence> {
  if (!context.projectId || !context.environmentId) {
    throw new Error('read-environment-migrations requires projectId and environmentId');
  }

  return buildEnvironmentMigrationReviewEvidence({
    projectId: context.projectId,
    environmentId: context.environmentId,
  });
}

async function executeReadEnvironmentSchema({
  context,
}: ToolHandlerArgs): Promise<EnvironmentEvidencePack> {
  if (!context.projectId || !context.environmentId) {
    throw new Error('read-environment-schema requires projectId and environmentId');
  }

  return buildEnvironmentEvidencePack({
    projectId: context.projectId,
    environmentId: context.environmentId,
  });
}

async function executeReadReleaseContext({
  context,
}: ToolHandlerArgs): Promise<ReleaseEvidencePack> {
  if (!context.projectId || !context.releaseId) {
    throw new Error('read-release-context requires projectId and releaseId');
  }

  return buildReleaseEvidencePack({
    projectId: context.projectId,
    releaseId: context.releaseId,
  });
}

async function executeReadIncidentContext({
  context,
}: ToolHandlerArgs): Promise<IncidentEvidencePack> {
  if (!context.projectId || !context.releaseId) {
    throw new Error('read-incident-context requires projectId and releaseId');
  }

  return buildIncidentEvidencePack({
    projectId: context.projectId,
    releaseId: context.releaseId,
  });
}

async function executeApproveMigrationRun({
  context,
}: ToolHandlerArgs): Promise<MigrationRunActionResult> {
  if (
    !context.actorUserId ||
    !context.projectId ||
    !context.migrationRunId ||
    !context.approvalToken
  ) {
    throw new Error(
      'approve-migration-run requires actorUserId, projectId, migrationRunId, and approvalToken'
    );
  }

  return approveMigrationRunForActor({
    actorUserId: context.actorUserId,
    projectId: context.projectId,
    runId: context.migrationRunId,
    approvalToken: context.approvalToken,
  });
}

const toolHandlers: Record<string, (args: ToolHandlerArgs) => Promise<JuanieToolOutput>> = {
  'read-environment-context': executeReadEnvironmentContext,
  'read-environment-variables': executeReadEnvironmentVariables,
  'read-environment-migrations': executeReadEnvironmentMigrations,
  'read-environment-schema': executeReadEnvironmentSchema,
  'approve-migration-run': executeApproveMigrationRun,
  'read-release-context': executeReadReleaseContext,
  'read-incident-context': executeReadIncidentContext,
};

function resolveAuditResource(input: JuanieToolExecutionContext): {
  resourceType: 'project' | 'environment' | 'release';
  resourceId?: string;
} {
  if (input.releaseId) {
    return { resourceType: 'release', resourceId: input.releaseId };
  }

  if (input.environmentId) {
    return { resourceType: 'environment', resourceId: input.environmentId };
  }

  return { resourceType: 'project', resourceId: input.projectId };
}

function assertToolExecutionAllowed(
  tool: JuanieToolDefinition,
  context: JuanieToolExecutionContext
): void {
  if (tool.riskLevel === 'read') {
    return;
  }

  if (tool.requiresReason && !context.reason) {
    throw new Error(`${tool.id} requires an explicit execution reason`);
  }

  if ((tool.requiresApprovalToken || tool.riskLevel === 'dangerous') && !context.approvalToken) {
    throw new Error(`${tool.id} requires an approval token`);
  }
}

export function executeJuanieTool<TToolId extends JuanieToolId>(input: {
  toolId: TToolId;
  context: JuanieToolExecutionContext;
}): Promise<JuanieToolOutputMap[TToolId]>;
export function executeJuanieTool(input: {
  toolId: string;
  context: JuanieToolExecutionContext;
}): Promise<JuanieToolOutput>;
export async function executeJuanieTool(input: {
  toolId: string;
  context: JuanieToolExecutionContext;
}): Promise<JuanieToolOutput> {
  const tool = getJuanieToolById(input.toolId);
  if (!tool) {
    throw new Error(`Unknown Juanie tool: ${input.toolId}`);
  }

  const handler = toolHandlers[input.toolId];
  if (!handler) {
    throw new Error(`No handler registered for Juanie tool: ${input.toolId}`);
  }

  assertToolExecutionAllowed(tool, input.context);
  const output = await handler({
    tool,
    context: input.context,
  });

  recordAIToolTrace({
    toolId: tool.id,
    scope: tool.scope,
    riskLevel: tool.riskLevel,
    reason: input.context.reason ?? null,
  });

  if (tool.requiresAudit) {
    const auditResource = resolveAuditResource(input.context);
    await createAuditLog({
      teamId: input.context.teamId,
      userId: input.context.actorUserId ?? undefined,
      action: 'ai.tool_executed',
      resourceType: auditResource.resourceType,
      resourceId: auditResource.resourceId,
      metadata: {
        toolId: tool.id,
        toolTitle: tool.title,
        auditLabel: tool.auditLabel ?? tool.id,
        riskLevel: tool.riskLevel,
        scope: tool.scope,
        reason: input.context.reason ?? null,
      },
    }).catch(() => undefined);
  }

  return output;
}
