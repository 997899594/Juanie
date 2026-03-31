import { recordAIRunTelemetry } from '@/lib/ai/core/telemetry';
import { type AIPlan, getPluginEntitlementSummary } from '@/lib/ai/runtime/entitlements';
import type { AIPlugin, AIPluginContext, AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import { recordAIPluginUsage } from '@/lib/ai/runtime/usage-service';

function resolvePluginResourceId(context: AIPluginContext): string {
  if (context.releaseId) {
    return context.releaseId;
  }

  if (context.previewEnvironmentId) {
    return context.previewEnvironmentId;
  }

  if (context.environmentId) {
    return context.environmentId;
  }

  if (context.projectId) {
    return context.projectId;
  }

  throw new Error('AI plugin context is missing resourceId');
}

export async function runAIPlugin<TEvidence, TOutput>(input: {
  plugin: AIPlugin<TEvidence, TOutput>;
  context: AIPluginContext;
  plan: AIPlan;
  evidence?: TEvidence;
  inputHash?: string | null;
}): Promise<AIPluginRunEnvelope<TOutput> & { evidence: TEvidence }> {
  const resourceId = resolvePluginResourceId(input.context);
  const startedAt = Date.now();

  try {
    const enabled = await input.plugin.isEnabled(input.context);
    if (!enabled) {
      throw new Error(`AI plugin ${input.plugin.manifest.id} is not enabled`);
    }

    const entitlementSummary = getPluginEntitlementSummary(input.plan, input.plugin.manifest.tier);
    if (entitlementSummary) {
      throw new Error(entitlementSummary);
    }

    const evidence = input.evidence ?? (await input.plugin.buildEvidence(input.context));
    const result = await input.plugin.run({
      context: input.context,
      evidence,
    });
    const latencyMs = Date.now() - startedAt;

    recordAIRunTelemetry({
      pluginId: input.plugin.manifest.id,
      modelPolicy: 'structured-high-quality',
      provider: result.provider,
      model: result.model,
      resourceType: input.plugin.manifest.resourceType,
      resourceId,
      latencyMs,
      degradedReason: result.degradation.reason,
    });

    await recordAIPluginUsage({
      pluginId: input.plugin.manifest.id,
      teamId: input.context.teamId,
      projectId: input.context.projectId,
      environmentId: input.context.environmentId ?? input.context.previewEnvironmentId,
      releaseId: input.context.releaseId,
      resourceType: input.plugin.manifest.resourceType,
      resourceId,
      provider: result.provider,
      model: result.model,
      inputHash: input.inputHash ?? null,
      status: 'succeeded',
      latencyMs,
      degradedReason: result.degradation.reason,
    });

    return {
      ...result,
      evidence,
    };
  } catch (error) {
    await recordAIPluginUsage({
      pluginId: input.plugin.manifest.id,
      teamId: input.context.teamId,
      projectId: input.context.projectId,
      environmentId: input.context.environmentId ?? input.context.previewEnvironmentId,
      releaseId: input.context.releaseId,
      resourceType: input.plugin.manifest.resourceType,
      resourceId,
      provider: null,
      model: null,
      inputHash: input.inputHash ?? null,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      degradedReason: null,
      errorMessage: error instanceof Error ? error.message : 'AI plugin execution failed',
    }).catch(() => undefined);

    throw error;
  }
}
