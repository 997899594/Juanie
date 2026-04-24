import { environmentSummaryPlugin } from '@/lib/ai/plugins/environment-summary/plugin';
import { envvarRiskPlugin } from '@/lib/ai/plugins/envvar-risk/plugin';
import { incidentIntelligencePlugin } from '@/lib/ai/plugins/incident-intelligence/plugin';
import { type JuaniePluginManifest, toJuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import { migrationReviewPlugin } from '@/lib/ai/plugins/migration-review/plugin';
import { releaseIntelligencePlugin } from '@/lib/ai/plugins/release-intelligence/plugin';
import type { AIPlugin } from '@/lib/ai/runtime/types';

const builtInPlugins = [
  environmentSummaryPlugin,
  migrationReviewPlugin,
  envvarRiskPlugin,
  releaseIntelligencePlugin,
  incidentIntelligencePlugin,
] as const satisfies readonly AIPlugin<unknown, unknown>[];

export function listBuiltInAIPlugins(): AIPlugin<unknown, unknown>[] {
  return [...builtInPlugins];
}

export function getBuiltInAIPluginById(id: string): AIPlugin<unknown, unknown> | null {
  return builtInPlugins.find((plugin) => plugin.manifest.id === id) ?? null;
}

export function listBuiltInJuaniePluginManifests(): JuaniePluginManifest[] {
  return builtInPlugins.map((plugin) => toJuaniePluginManifest(plugin.manifest));
}
