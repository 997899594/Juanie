import type { AIPluginManifest } from '@/lib/ai/runtime/types';

export type JuaniePluginManifest = Pick<
  AIPluginManifest,
  | 'id'
  | 'version'
  | 'title'
  | 'description'
  | 'kind'
  | 'scope'
  | 'capabilities'
  | 'skills'
  | 'tools'
  | 'actions'
  | 'contextProviders'
  | 'surfaces'
  | 'permissions'
>;

export function toJuaniePluginManifest(manifest: AIPluginManifest): JuaniePluginManifest {
  return {
    id: manifest.id,
    version: manifest.version,
    title: manifest.title,
    description: manifest.description,
    kind: manifest.kind,
    scope: manifest.scope,
    capabilities: manifest.capabilities,
    skills: manifest.skills,
    tools: manifest.tools,
    actions: manifest.actions,
    contextProviders: manifest.contextProviders,
    surfaces: manifest.surfaces,
    permissions: manifest.permissions,
  };
}
