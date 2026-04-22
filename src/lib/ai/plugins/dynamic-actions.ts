import type { JuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import type { AIPluginContext } from '@/lib/ai/runtime/types';
import { getJuanieToolById } from '@/lib/ai/tools/registry';

export interface ResolvedDynamicPluginAction {
  id: string;
  title: string;
  description: string;
  toolId: string;
  surface: 'action-center' | 'task-center';
  reason: string;
  requiresConfirmation: boolean;
  available: boolean;
  blockedReason: string | null;
}

function isActionScopeSatisfied(
  scope: JuaniePluginManifest['scope'],
  context: AIPluginContext
): boolean {
  switch (scope) {
    case 'team':
    case 'global':
      return !!context.teamId;
    case 'project':
      return !!context.projectId;
    case 'environment':
      return !!(context.environmentId ?? context.previewEnvironmentId);
    case 'release':
      return !!context.releaseId;
  }
}

export function resolveDynamicPluginActions(
  manifest: JuaniePluginManifest,
  context: AIPluginContext
): ResolvedDynamicPluginAction[] {
  return manifest.actions.map((action) => {
    const tool = getJuanieToolById(action.toolId);

    if (!tool) {
      return {
        ...action,
        available: false,
        blockedReason: `Unknown tool: ${action.toolId}`,
      };
    }

    if (tool.riskLevel === 'read') {
      return {
        ...action,
        available: false,
        blockedReason: `${action.toolId} is not a write-capable tool`,
      };
    }

    if (!isActionScopeSatisfied(manifest.scope, context)) {
      return {
        ...action,
        available: false,
        blockedReason: `${manifest.scope} scope is not satisfied by current context`,
      };
    }

    return {
      ...action,
      available: true,
      blockedReason: null,
    };
  });
}
