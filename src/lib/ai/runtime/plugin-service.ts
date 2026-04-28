import { aiProvider } from '@/lib/ai/core/provider';
import { type AIPluginAvailability, getAIPluginAvailability } from '@/lib/ai/runtime/entitlements';
import { getAIPluginByIdForTeam } from '@/lib/ai/runtime/plugin-registry';
import { runAIPlugin } from '@/lib/ai/runtime/plugin-runner';
import { resolveAIPluginResourceId } from '@/lib/ai/runtime/plugin-scope';
import {
  computeAIInputHash,
  getFreshAIPluginSnapshot,
  getLatestAIPluginSnapshot,
  type StoredAIPluginSnapshot,
  saveAIPluginSnapshot,
} from '@/lib/ai/runtime/snapshot-service';
import type { AIPluginContext, AIPluginManifest } from '@/lib/ai/runtime/types';
import { resolvePrimarySkill } from '@/lib/ai/skills/runtime';

export interface ResolvedAIPluginSnapshot<TOutput = unknown> {
  manifest: AIPluginManifest;
  availability: AIPluginAvailability;
  snapshot: StoredAIPluginSnapshot<TOutput> | null;
  source: 'cache' | 'fresh' | 'none';
  stale: boolean;
  providerStatus: ReturnType<typeof aiProvider.getStatus>;
  errorMessage: string | null;
}

function buildResolvedAIPluginSnapshot<TOutput>(input: {
  manifest: AIPluginManifest;
  availability: AIPluginAvailability;
  snapshot: StoredAIPluginSnapshot<TOutput> | null;
  source: ResolvedAIPluginSnapshot<TOutput>['source'];
  stale: boolean;
  errorMessage?: string | null;
}): ResolvedAIPluginSnapshot<TOutput> {
  return {
    manifest: input.manifest,
    availability: input.availability,
    snapshot: input.snapshot,
    source: input.source,
    stale: input.stale,
    providerStatus: aiProvider.getStatus(),
    errorMessage: input.errorMessage ?? null,
  };
}

export async function resolveAIPluginSnapshot<TOutput>(input: {
  pluginId: string;
  context: AIPluginContext;
  forceRefresh?: boolean;
  allowLiveExecution?: boolean;
}): Promise<ResolvedAIPluginSnapshot<TOutput>> {
  const plugin = await getAIPluginByIdForTeam(input.context.teamId, input.pluginId);
  if (!plugin) {
    throw new Error(`Unknown AI plugin: ${input.pluginId}`);
  }
  resolvePrimarySkill(plugin);

  const resourceId = resolveAIPluginResourceId(plugin, input.context);
  const allowLiveExecution = input.allowLiveExecution ?? true;

  if (!allowLiveExecution && !input.forceRefresh) {
    const [availability, latestSnapshot] = await Promise.all([
      getAIPluginAvailability({
        teamId: input.context.teamId,
        pluginId: plugin.manifest.id,
        requiredTier: plugin.manifest.tier,
      }),
      getLatestAIPluginSnapshot<TOutput>({
        pluginId: plugin.manifest.id,
        teamId: input.context.teamId,
        resourceType: plugin.manifest.resourceType,
        resourceId,
      }),
    ]);

    return buildResolvedAIPluginSnapshot({
      manifest: plugin.manifest,
      availability,
      snapshot: latestSnapshot,
      source: latestSnapshot ? 'cache' : 'none',
      stale: latestSnapshot !== null,
    });
  }

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
    return buildResolvedAIPluginSnapshot({
      manifest: plugin.manifest,
      availability,
      snapshot: freshSnapshot,
      source: 'cache',
      stale: false,
    });
  }

  if (!availability.enabled) {
    return buildResolvedAIPluginSnapshot({
      manifest: plugin.manifest,
      availability,
      snapshot: latestSnapshot,
      source: latestSnapshot ? 'cache' : 'none',
      stale: latestSnapshot !== null,
    });
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

    return buildResolvedAIPluginSnapshot({
      manifest: plugin.manifest,
      availability,
      snapshot,
      source: 'fresh',
      stale: false,
    });
  } catch (error) {
    return buildResolvedAIPluginSnapshot({
      manifest: plugin.manifest,
      availability,
      snapshot: latestSnapshot,
      source: latestSnapshot ? 'cache' : 'none',
      stale: latestSnapshot !== null,
      errorMessage: error instanceof Error ? error.message : 'AI plugin execution failed',
    });
  }
}
