import type { AIPlugin, AIPluginContext } from '@/lib/ai/runtime/types';

export function assertAIPluginContext(
  plugin: AIPlugin<unknown, unknown>,
  context: AIPluginContext
): void {
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

export function resolveAIPluginResourceId(
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

export function resolveAIPluginAuditResourceType(
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
