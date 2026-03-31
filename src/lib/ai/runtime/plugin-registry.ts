import { incidentIntelligencePlugin } from '@/lib/ai/plugins/incident-intelligence/plugin';
import { releaseIntelligencePlugin } from '@/lib/ai/plugins/release-intelligence/plugin';
import type { AIPlugin } from '@/lib/ai/runtime/types';

const BUILT_IN_PLUGINS = [releaseIntelligencePlugin, incidentIntelligencePlugin] as const;

export function listAIPlugins(): AIPlugin<unknown, unknown>[] {
  return [...BUILT_IN_PLUGINS];
}

export function getAIPluginById(id: string): AIPlugin<unknown, unknown> | null {
  return BUILT_IN_PLUGINS.find((plugin) => plugin.manifest.id === id) ?? null;
}
