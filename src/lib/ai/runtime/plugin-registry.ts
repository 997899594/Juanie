import { eq } from 'drizzle-orm';
import { createDynamicAIPlugin } from '@/lib/ai/plugins/dynamic-plugin';
import { extractDynamicPluginManifestsFromConfig } from '@/lib/ai/plugins/dynamic-registry';
import { environmentSummaryPlugin } from '@/lib/ai/plugins/environment-summary/plugin';
import { envvarRiskPlugin } from '@/lib/ai/plugins/envvar-risk/plugin';
import { incidentIntelligencePlugin } from '@/lib/ai/plugins/incident-intelligence/plugin';
import type { JuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import { migrationReviewPlugin } from '@/lib/ai/plugins/migration-review/plugin';
import { getJuaniePluginManifestById, listJuaniePluginManifests } from '@/lib/ai/plugins/registry';
import { releaseIntelligencePlugin } from '@/lib/ai/plugins/release-intelligence/plugin';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import { db } from '@/lib/db';
import { aiPluginInstallations } from '@/lib/db/schema';

const BUILT_IN_PLUGINS = [
  environmentSummaryPlugin,
  migrationReviewPlugin,
  envvarRiskPlugin,
  releaseIntelligencePlugin,
  incidentIntelligencePlugin,
] as const;

export function listAIPlugins(): AIPlugin<unknown, unknown>[] {
  return [...BUILT_IN_PLUGINS];
}

export function getAIPluginById(id: string): AIPlugin<unknown, unknown> | null {
  return BUILT_IN_PLUGINS.find((plugin) => plugin.manifest.id === id) ?? null;
}

export function listAIPluginsForDynamicManifests(
  dynamicManifests: JuaniePluginManifest[]
): AIPlugin<unknown, unknown>[] {
  return [
    ...BUILT_IN_PLUGINS,
    ...dynamicManifests.map((manifest) => createDynamicAIPlugin(manifest)),
  ];
}

export async function listAIPluginsForTeam(teamId: string): Promise<AIPlugin<unknown, unknown>[]> {
  const installations = await db.query.aiPluginInstallations.findMany({
    where: eq(aiPluginInstallations.teamId, teamId),
  });
  const dynamicManifests = installations.flatMap((installation) =>
    extractDynamicPluginManifestsFromConfig(installation.config)
  );

  return listAIPluginsForDynamicManifests(dynamicManifests);
}

export async function getAIPluginByIdForTeam(
  teamId: string,
  id: string
): Promise<AIPlugin<unknown, unknown> | null> {
  const builtInPlugin = getAIPluginById(id);
  if (builtInPlugin) {
    return builtInPlugin;
  }

  const plugins = await listAIPluginsForTeam(teamId);
  return plugins.find((plugin) => plugin.manifest.id === id) ?? null;
}

export { getJuaniePluginManifestById, listJuaniePluginManifests };
