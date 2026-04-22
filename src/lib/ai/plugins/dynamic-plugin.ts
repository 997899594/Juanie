import { resolveDynamicPluginActions } from '@/lib/ai/plugins/dynamic-actions';
import type { JuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import type {
  AIPlugin,
  AIPluginContext,
  AIPluginManifest,
  AIPluginResourceType,
  AIPluginSurface,
} from '@/lib/ai/runtime/types';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';
import {
  executeJuanieTool,
  type JuanieToolExecutionContext,
  type JuanieToolId,
  type JuanieToolOutput,
} from '@/lib/ai/tools/runtime';
import { runDynamicPluginWorkflow } from '@/lib/ai/workflows/dynamic-plugin';

export interface DynamicPluginEvidence {
  manifest: JuaniePluginManifest;
  toolResults: Record<string, JuanieToolOutput>;
}

function resolveSurface(scope: JuaniePluginManifest['scope']): AIPluginSurface {
  switch (scope) {
    case 'release':
      return 'release';
    case 'environment':
      return 'environment';
    case 'team':
      return 'team';
    case 'global':
    case 'project':
      return 'project';
  }
}

function resolveResourceType(scope: JuaniePluginManifest['scope']): AIPluginResourceType {
  switch (scope) {
    case 'release':
      return 'release';
    case 'environment':
      return 'environment';
    case 'team':
    case 'global':
      return 'team';
    case 'project':
      return 'project';
  }
}

function toRuntimeManifest(manifest: JuaniePluginManifest): AIPluginManifest {
  return {
    id: manifest.id,
    name: manifest.title,
    title: manifest.title,
    description: manifest.description,
    version: manifest.version,
    tier: 'free',
    kind: manifest.kind,
    scope: manifest.scope,
    surface: resolveSurface(manifest.scope),
    surfaces: manifest.surfaces,
    resourceType: resolveResourceType(manifest.scope),
    billingMetric: 'per_run',
    snapshotSchema: `${manifest.id}-dynamic-v1`,
    cacheTtlSeconds: 600,
    supportsManualRefresh: true,
    eventTriggers: [],
    capabilities: manifest.capabilities,
    skills: manifest.skills,
    tools: manifest.tools,
    actions: manifest.actions,
    contextProviders: manifest.contextProviders,
    permissions: manifest.permissions,
  };
}

function toToolExecutionContext(context: AIPluginContext): JuanieToolExecutionContext {
  return {
    actorUserId: context.actorUserId,
    teamId: context.teamId,
    projectId: context.projectId,
    environmentId: context.environmentId ?? context.previewEnvironmentId,
    releaseId: context.releaseId,
  };
}

export function createDynamicAIPlugin(
  manifest: JuaniePluginManifest
): AIPlugin<DynamicPluginEvidence, DynamicPluginOutput> {
  const runtimeManifest = toRuntimeManifest(manifest);

  return {
    manifest: runtimeManifest,
    async isEnabled() {
      return true;
    },
    async buildEvidence(context) {
      const executionContext = toToolExecutionContext(context);
      const toolResults = Object.fromEntries(
        await Promise.all(
          manifest.tools.map(async (toolId) => [
            toolId,
            await executeJuanieTool({
              toolId: toolId as JuanieToolId,
              context: executionContext,
            }),
          ])
        )
      );

      return {
        manifest: {
          ...manifest,
          actions: resolveDynamicPluginActions(manifest, context),
        },
        toolResults,
      };
    },
    async run({ evidence }) {
      return runDynamicPluginWorkflow({
        evidence,
        skillId: manifest.skills[0] ?? null,
      });
    },
  };
}
