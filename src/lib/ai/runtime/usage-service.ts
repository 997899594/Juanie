import { db } from '@/lib/db';
import { aiPluginRuns } from '@/lib/db/schema';

export interface AIPluginUsageRecord {
  pluginId: string;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  releaseId?: string;
  resourceType: string;
  resourceId: string;
  provider: string | null;
  model: string | null;
  inputHash?: string | null;
  status: 'succeeded' | 'failed';
  latencyMs: number | null;
  degradedReason: string | null;
  errorMessage?: string | null;
}

export async function recordAIPluginUsage(input: AIPluginUsageRecord): Promise<void> {
  await db.insert(aiPluginRuns).values({
    pluginId: input.pluginId,
    teamId: input.teamId,
    projectId: input.projectId ?? null,
    environmentId: input.environmentId ?? null,
    releaseId: input.releaseId ?? null,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    provider: input.provider,
    model: input.model,
    inputHash: input.inputHash ?? null,
    status: input.status,
    latencyMs: input.latencyMs,
    degradedReason: input.degradedReason,
    errorMessage: input.errorMessage ?? null,
  });
}
