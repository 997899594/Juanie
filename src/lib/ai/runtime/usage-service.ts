import type { AIToolTraceEntry } from '@/lib/ai/runtime/tool-trace';
import { db } from '@/lib/db';
import { aiPluginRuns } from '@/lib/db/schema';

export interface AIPluginUsageRecord {
  pluginId: string;
  skillId?: string | null;
  actorUserId?: string | null;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  releaseId?: string;
  resourceType: string;
  resourceId: string;
  provider: string | null;
  model: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  outputSchema?: string | null;
  toolCalls?: AIToolTraceEntry[];
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
  inputHash?: string | null;
  status: 'succeeded' | 'failed';
  latencyMs: number | null;
  degradedReason: string | null;
  errorMessage?: string | null;
}

export async function recordAIPluginUsage(input: AIPluginUsageRecord): Promise<void> {
  await db.insert(aiPluginRuns).values({
    pluginId: input.pluginId,
    skillId: input.skillId ?? null,
    actorUserId: input.actorUserId ?? null,
    teamId: input.teamId,
    projectId: input.projectId ?? null,
    environmentId: input.environmentId ?? null,
    releaseId: input.releaseId ?? null,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    provider: input.provider,
    model: input.model,
    promptKey: input.promptKey ?? null,
    promptVersion: input.promptVersion ?? null,
    outputSchema: input.outputSchema ?? null,
    toolCalls: input.toolCalls ?? [],
    inputTokens: input.usage?.inputTokens ?? null,
    outputTokens: input.usage?.outputTokens ?? null,
    totalTokens: input.usage?.totalTokens ?? null,
    inputHash: input.inputHash ?? null,
    status: input.status,
    latencyMs: input.latencyMs,
    degradedReason: input.degradedReason,
    errorMessage: input.errorMessage ?? null,
  });
}
