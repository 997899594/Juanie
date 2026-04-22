import { recordAIRunTelemetry } from '@/lib/ai/core/telemetry';
import { type AIPlan, getPluginEntitlementSummary } from '@/lib/ai/runtime/entitlements';
import { withAIToolTrace } from '@/lib/ai/runtime/tool-trace';
import type { AIPlugin, AIPluginContext, AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import { recordAIPluginUsage } from '@/lib/ai/runtime/usage-service';
import { resolvePrimarySkill } from '@/lib/ai/skills/runtime';
import { createAuditLog } from '@/lib/audit';

function assertAIPluginContext(plugin: AIPlugin<unknown, unknown>, context: AIPluginContext): void {
  switch (plugin.manifest.scope) {
    case 'team':
      if (!context.teamId) {
        throw new Error(`AI plugin ${plugin.manifest.id} requires team scope`);
      }
      return;
    case 'project':
      if (!context.projectId) {
        throw new Error(`AI plugin ${plugin.manifest.id} requires projectId for project scope`);
      }
      return;
    case 'environment':
      if (!(context.environmentId ?? context.previewEnvironmentId)) {
        throw new Error(
          `AI plugin ${plugin.manifest.id} requires environmentId or previewEnvironmentId for environment scope`
        );
      }
      return;
    case 'release':
      if (!context.releaseId) {
        throw new Error(`AI plugin ${plugin.manifest.id} requires releaseId for release scope`);
      }
      return;
    case 'global':
      if (!context.teamId) {
        throw new Error(`AI plugin ${plugin.manifest.id} requires teamId for global scope`);
      }
      return;
  }
}

function resolvePluginResourceId(
  plugin: AIPlugin<unknown, unknown>,
  context: AIPluginContext
): string {
  if (plugin.manifest.resourceType === 'team') {
    return context.teamId;
  }

  if (plugin.manifest.resourceType === 'release' || context.releaseId) {
    if (!context.releaseId) {
      throw new Error(`AI plugin ${plugin.manifest.id} is missing releaseId`);
    }

    return context.releaseId;
  }

  if (context.previewEnvironmentId) {
    return context.previewEnvironmentId;
  }

  if (plugin.manifest.resourceType === 'environment' || context.environmentId) {
    if (!context.environmentId) {
      throw new Error(`AI plugin ${plugin.manifest.id} is missing environmentId`);
    }

    return context.environmentId;
  }

  if (context.projectId) {
    return context.projectId;
  }

  throw new Error('AI plugin context is missing resourceId');
}

function resolveAuditResourceType(
  plugin: AIPlugin<unknown, unknown>,
  context: AIPluginContext
): 'project' | 'environment' | 'release' | 'team' {
  if (plugin.manifest.resourceType === 'release' || context.releaseId) {
    return 'release';
  }

  if (plugin.manifest.resourceType === 'environment' || context.environmentId) {
    return 'environment';
  }

  if (plugin.manifest.resourceType === 'team') {
    return 'team';
  }

  return 'project';
}

export async function runAIPlugin<TEvidence, TOutput>(input: {
  plugin: AIPlugin<TEvidence, TOutput>;
  context: AIPluginContext;
  plan: AIPlan;
  evidence?: TEvidence;
  inputHash?: string | null;
}): Promise<AIPluginRunEnvelope<TOutput> & { evidence: TEvidence }> {
  assertAIPluginContext(input.plugin, input.context);
  const resourceId = resolvePluginResourceId(input.plugin, input.context);
  const skill = resolvePrimarySkill(input.plugin);
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

    const tracedRun = await withAIToolTrace(async () => {
      const evidence = input.evidence ?? (await input.plugin.buildEvidence(input.context));
      const result = await input.plugin.run({
        context: input.context,
        evidence,
      });

      return {
        evidence,
        result,
      };
    });
    const evidence = tracedRun.result.evidence;
    const result = tracedRun.result.result;
    const toolCalls = tracedRun.calls;
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
      actorUserId: input.context.actorUserId ?? null,
      teamId: input.context.teamId,
      projectId: input.context.projectId,
      environmentId: input.context.environmentId ?? input.context.previewEnvironmentId,
      releaseId: input.context.releaseId,
      resourceType: input.plugin.manifest.resourceType,
      resourceId,
      provider: result.provider,
      model: result.model,
      skillId: result.skillId ?? skill?.id ?? null,
      promptKey: result.promptKey ?? null,
      promptVersion: result.promptVersion ?? null,
      outputSchema: result.outputSchema ?? input.plugin.manifest.snapshotSchema,
      toolCalls,
      usage: result.usage ?? null,
      inputHash: input.inputHash ?? null,
      status: 'succeeded',
      latencyMs,
      degradedReason: result.degradation.reason,
    });

    if (input.plugin.manifest.permissions.requiresAudit) {
      await createAuditLog({
        teamId: input.context.teamId,
        userId: input.context.actorUserId ?? undefined,
        action: 'ai.plugin_executed',
        resourceType: resolveAuditResourceType(input.plugin, input.context),
        resourceId: resourceId,
        metadata: {
          pluginId: input.plugin.manifest.id,
          pluginTitle: input.plugin.manifest.title,
          skillId: result.skillId ?? skill?.id ?? null,
          scope: input.plugin.manifest.scope,
          surface: input.plugin.manifest.surface,
          skills: input.plugin.manifest.skills,
          tools: input.plugin.manifest.tools,
          capabilities: input.plugin.manifest.capabilities,
          permissions: input.plugin.manifest.permissions,
          provider: result.provider,
          model: result.model,
          promptKey: result.promptKey ?? null,
          promptVersion: result.promptVersion ?? null,
          outputSchema: result.outputSchema ?? input.plugin.manifest.snapshotSchema,
          toolCalls,
          usage: result.usage ?? null,
          degradedReason: result.degradation.reason,
          latencyMs,
          status: 'succeeded',
        },
      }).catch(() => undefined);
    }

    return {
      ...result,
      evidence,
    };
  } catch (error) {
    await recordAIPluginUsage({
      pluginId: input.plugin.manifest.id,
      actorUserId: input.context.actorUserId ?? null,
      teamId: input.context.teamId,
      projectId: input.context.projectId,
      environmentId: input.context.environmentId ?? input.context.previewEnvironmentId,
      releaseId: input.context.releaseId,
      resourceType: input.plugin.manifest.resourceType,
      resourceId,
      provider: null,
      model: null,
      skillId: skill?.id ?? null,
      promptKey: null,
      promptVersion: null,
      outputSchema: input.plugin.manifest.snapshotSchema,
      toolCalls: [],
      usage: null,
      inputHash: input.inputHash ?? null,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      degradedReason: null,
      errorMessage: error instanceof Error ? error.message : 'AI plugin execution failed',
    }).catch(() => undefined);

    if (input.plugin.manifest.permissions.requiresAudit) {
      await createAuditLog({
        teamId: input.context.teamId,
        userId: input.context.actorUserId ?? undefined,
        action: 'ai.plugin_executed',
        resourceType: resolveAuditResourceType(input.plugin, input.context),
        resourceId: resourceId,
        metadata: {
          pluginId: input.plugin.manifest.id,
          pluginTitle: input.plugin.manifest.title,
          skillId: skill?.id ?? null,
          scope: input.plugin.manifest.scope,
          surface: input.plugin.manifest.surface,
          skills: input.plugin.manifest.skills,
          tools: input.plugin.manifest.tools,
          capabilities: input.plugin.manifest.capabilities,
          permissions: input.plugin.manifest.permissions,
          provider: null,
          model: null,
          promptKey: null,
          promptVersion: null,
          outputSchema: input.plugin.manifest.snapshotSchema,
          toolCalls: [],
          latencyMs: Date.now() - startedAt,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'AI plugin execution failed',
        },
      }).catch(() => undefined);
    }

    throw error;
  }
}
