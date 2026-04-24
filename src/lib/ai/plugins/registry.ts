import { listBuiltInJuaniePluginManifests } from '@/lib/ai/plugins/builtins';
import type { JuaniePluginManifest } from '@/lib/ai/plugins/manifest';

const builtInPluginManifests = listBuiltInJuaniePluginManifests() satisfies JuaniePluginManifest[];

export function listJuaniePluginManifests(): JuaniePluginManifest[] {
  return [...builtInPluginManifests];
}

export function getJuaniePluginManifestById(id: string): JuaniePluginManifest | null {
  return builtInPluginManifests.find((manifest) => manifest.id === id) ?? null;
}
