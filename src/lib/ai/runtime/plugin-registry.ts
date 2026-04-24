import { eq } from 'drizzle-orm';
import { getBuiltInAIPluginById, listBuiltInAIPlugins } from '@/lib/ai/plugins/builtins';
import { createDynamicAIPlugin } from '@/lib/ai/plugins/dynamic-plugin';
import { extractDynamicPluginManifestsFromConfig } from '@/lib/ai/plugins/dynamic-registry';
import type { JuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import { getJuaniePluginManifestById, listJuaniePluginManifests } from '@/lib/ai/plugins/registry';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import { db } from '@/lib/db';
import { aiPluginInstallations } from '@/lib/db/schema';

export function listAIPlugins(): AIPlugin<unknown, unknown>[] {
  return listBuiltInAIPlugins();
}

export function getAIPluginById(id: string): AIPlugin<unknown, unknown> | null {
  return getBuiltInAIPluginById(id);
}

export function listAIPluginsForDynamicManifests(
  dynamicManifests: JuaniePluginManifest[]
): AIPlugin<unknown, unknown>[] {
  return [
    ...listBuiltInAIPlugins(),
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
