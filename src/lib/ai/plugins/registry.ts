import { environmentSummaryManifest } from '@/lib/ai/plugins/environment-summary/manifest';
import { envvarRiskManifest } from '@/lib/ai/plugins/envvar-risk/manifest';
import { incidentIntelligenceManifest } from '@/lib/ai/plugins/incident-intelligence/manifest';
import { type JuaniePluginManifest, toJuaniePluginManifest } from '@/lib/ai/plugins/manifest';
import { migrationReviewManifest } from '@/lib/ai/plugins/migration-review/manifest';
import { releaseIntelligenceManifest } from '@/lib/ai/plugins/release-intelligence/manifest';

const builtInPluginManifests = [
  toJuaniePluginManifest(environmentSummaryManifest),
  toJuaniePluginManifest(releaseIntelligenceManifest),
  toJuaniePluginManifest(incidentIntelligenceManifest),
  toJuaniePluginManifest(migrationReviewManifest),
  toJuaniePluginManifest(envvarRiskManifest),
] satisfies JuaniePluginManifest[];

export function listJuaniePluginManifests(): JuaniePluginManifest[] {
  return [...builtInPluginManifests];
}

export function getJuaniePluginManifestById(id: string): JuaniePluginManifest | null {
  return builtInPluginManifests.find((manifest) => manifest.id === id) ?? null;
}
