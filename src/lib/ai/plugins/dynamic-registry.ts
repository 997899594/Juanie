import type { JuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import {
  type JuaniePluginManifestInput,
  juaniePluginManifestSchema,
} from '@/lib/ai/plugins/manifest-schema';
import { listJuaniePluginManifests } from '@/lib/ai/plugins/registry';

export interface ResolveDynamicPluginCatalogInput {
  manifests?: JuaniePluginManifestInput[];
}

export function extractDynamicPluginManifestsFromConfig(config: unknown): JuaniePluginManifest[] {
  if (!config || typeof config !== 'object') {
    return [];
  }

  const dynamicConfig = config as {
    manifest?: JuaniePluginManifestInput;
    manifests?: JuaniePluginManifestInput[];
  };
  const candidates = [
    ...(dynamicConfig.manifest ? [dynamicConfig.manifest] : []),
    ...(Array.isArray(dynamicConfig.manifests) ? dynamicConfig.manifests : []),
  ];

  return candidates.map((manifest) => juaniePluginManifestSchema.parse(manifest));
}

export interface JuaniePluginCatalog {
  builtIn: JuaniePluginManifest[];
  dynamic: JuaniePluginManifest[];
  all: JuaniePluginManifest[];
}

function ensureUniquePluginIds(manifests: JuaniePluginManifest[]): void {
  const seen = new Set<string>();

  for (const manifest of manifests) {
    if (seen.has(manifest.id)) {
      throw new Error(`Duplicate plugin manifest id: ${manifest.id}`);
    }

    seen.add(manifest.id);
  }
}

export function resolveDynamicPluginCatalog(
  input: ResolveDynamicPluginCatalogInput = {}
): JuaniePluginCatalog {
  const builtIn = listJuaniePluginManifests();
  const dynamic = (input.manifests ?? []).map((manifest) =>
    juaniePluginManifestSchema.parse(manifest)
  );
  const all = [...builtIn, ...dynamic];

  ensureUniquePluginIds(all);

  return {
    builtIn,
    dynamic,
    all,
  };
}
