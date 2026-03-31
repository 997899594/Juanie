import { aiProvider } from '@/lib/ai/core/provider';
import { type AIPluginAvailability, getAIPluginAvailability } from '@/lib/ai/runtime/entitlements';
import { getAIPluginById } from '@/lib/ai/runtime/plugin-registry';
import { runAIPlugin } from '@/lib/ai/runtime/plugin-runner';
import {
  computeAIInputHash,
  getFreshAIPluginSnapshot,
  getLatestAIPluginSnapshot,
  type StoredAIPluginSnapshot,
  saveAIPluginSnapshot,
} from '@/lib/ai/runtime/snapshot-service';
import type { AIPluginContext, AIPluginManifest } from '@/lib/ai/runtime/types';

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

export interface ResolvedAIPluginSnapshot<TOutput = unknown> {
  manifest: AIPluginManifest;
  availability: AIPluginAvailability;
  snapshot: StoredAIPluginSnapshot<TOutput> | null;
  source: 'cache' | 'fresh' | 'none';
  stale: boolean;
  providerStatus: ReturnType<typeof aiProvider.getStatus>;
  errorMessage: string | null;
}

export async function resolveAIPluginSnapshot<TOutput>(input: {
  pluginId: string;
  context: AIPluginContext;
  forceRefresh?: boolean;
}): Promise<ResolvedAIPluginSnapshot<TOutput>> {
  const plugin = getAIPluginById(input.pluginId);
  if (!plugin) {
    throw new Error(`Unknown AI plugin: ${input.pluginId}`);
  }

  const resourceId = resolvePluginResourceId(input.context);
  const evidence = await plugin.buildEvidence(input.context);
  const inputHash = computeAIInputHash(evidence);

  const [availability, freshSnapshot, latestSnapshot] = await Promise.all([
    getAIPluginAvailability({
      teamId: input.context.teamId,
      pluginId: plugin.manifest.id,
      requiredTier: plugin.manifest.tier,
    }),
    input.forceRefresh
      ? Promise.resolve(null)
      : getFreshAIPluginSnapshot<TOutput>({
          pluginId: plugin.manifest.id,
          teamId: input.context.teamId,
          resourceType: plugin.manifest.resourceType,
          resourceId,
          schemaVersion: plugin.manifest.snapshotSchema,
          inputHash,
          maxAgeSeconds: plugin.manifest.cacheTtlSeconds,
        }),
    getLatestAIPluginSnapshot<TOutput>({
      pluginId: plugin.manifest.id,
      teamId: input.context.teamId,
      resourceType: plugin.manifest.resourceType,
      resourceId,
    }),
  ]);

  if (freshSnapshot) {
    return {
      manifest: plugin.manifest,
      availability,
      snapshot: freshSnapshot,
      source: 'cache',
      stale: false,
      providerStatus: aiProvider.getStatus(),
      errorMessage: null,
    };
  }

  if (!availability.enabled) {
    return {
      manifest: plugin.manifest,
      availability,
      snapshot: latestSnapshot,
      source: latestSnapshot ? 'cache' : 'none',
      stale: latestSnapshot !== null,
      providerStatus: aiProvider.getStatus(),
      errorMessage: null,
    };
  }

  try {
    const run = await runAIPlugin({
      plugin,
      context: input.context,
      plan: availability.plan,
      evidence,
      inputHash,
    });

    const snapshot = await saveAIPluginSnapshot<TOutput>({
      pluginId: plugin.manifest.id,
      teamId: input.context.teamId,
      projectId: input.context.projectId,
      environmentId: input.context.environmentId ?? input.context.previewEnvironmentId,
      releaseId: input.context.releaseId,
      resourceType: plugin.manifest.resourceType,
      resourceId,
      schemaVersion: plugin.manifest.snapshotSchema,
      inputHash,
      provider: run.provider,
      model: run.model,
      degradedReason: run.degradation.reason,
      output: run.output as TOutput,
      generatedAt: new Date().toISOString(),
    });

    return {
      manifest: plugin.manifest,
      availability,
      snapshot,
      source: 'fresh',
      stale: false,
      providerStatus: aiProvider.getStatus(),
      errorMessage: null,
    };
  } catch (error) {
    return {
      manifest: plugin.manifest,
      availability,
      snapshot: latestSnapshot,
      source: latestSnapshot ? 'cache' : 'none',
      stale: latestSnapshot !== null,
      providerStatus: aiProvider.getStatus(),
      errorMessage: error instanceof Error ? error.message : 'AI plugin execution failed',
    };
  }
}
