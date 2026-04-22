import { describe, expect, it } from 'bun:test';
import {
  getAIPluginById,
  getJuaniePluginManifestById,
  listAIPlugins,
  listAIPluginsForDynamicManifests,
  listJuaniePluginManifests,
} from '@/lib/ai/runtime/plugin-registry';

describe('ai plugin registry', () => {
  it('registers the environment summary plugin in runtime and manifest registries', () => {
    const runtimePlugin = getAIPluginById('environment-summary');
    const manifest = getJuaniePluginManifestById('environment-summary');

    expect(runtimePlugin?.manifest.id).toBe('environment-summary');
    expect(runtimePlugin?.manifest.surface).toBe('environment');
    expect(manifest?.scope).toBe('environment');
    expect(manifest?.skills).toContain('environment-skill');
  });

  it('keeps built-in plugin lists in sync', () => {
    expect(listAIPlugins().map((plugin) => plugin.manifest.id)).toContain('environment-summary');
    expect(listJuaniePluginManifests().map((manifest) => manifest.id)).toContain(
      'environment-summary'
    );
  });

  it('registers migration-review and envvar-risk as built-in environment plugins', () => {
    const runtimeIds = listAIPlugins().map((plugin) => plugin.manifest.id);
    const manifestIds = listJuaniePluginManifests().map((manifest) => manifest.id);

    expect(runtimeIds).toContain('migration-review');
    expect(runtimeIds).toContain('envvar-risk');
    expect(manifestIds).toContain('migration-review');
    expect(manifestIds).toContain('envvar-risk');

    expect(getJuaniePluginManifestById('migration-review')?.tools).toContain(
      'read-environment-migrations'
    );
    expect(getJuaniePluginManifestById('envvar-risk')?.tools).toContain(
      'read-environment-variables'
    );
  });

  it('adapts dynamic manifests into runtime plugins', () => {
    const runtimePlugins = listAIPluginsForDynamicManifests([
      {
        id: 'team-custom-risk',
        version: '1',
        title: 'Team Custom Risk',
        description: 'Custom risk evaluator.',
        kind: 'workspace',
        scope: 'environment',
        capabilities: ['custom-risk'],
        skills: ['environment-skill'],
        tools: ['read-environment-context'],
        actions: [],
        contextProviders: ['environment-context'],
        surfaces: ['inline-card'],
        permissions: {
          level: 'read',
          requiresAudit: true,
        },
      },
    ]);
    const plugin = runtimePlugins.find((item) => item.manifest.id === 'team-custom-risk');

    expect(plugin?.manifest.kind).toBe('workspace');
    expect(plugin?.manifest.scope).toBe('environment');
    expect(plugin?.manifest.resourceType).toBe('environment');
    expect(plugin?.manifest.permissions.level).toBe('read');
  });

  it('adapts release-scoped dynamic manifests with declared actions', () => {
    const runtimePlugins = listAIPluginsForDynamicManifests([
      {
        id: 'release-migration-guard',
        version: '1',
        title: 'Release Migration Guard',
        description: 'Review release migration risk.',
        kind: 'workspace',
        scope: 'release',
        capabilities: ['release-risk'],
        skills: ['release-skill'],
        tools: ['read-release-context'],
        actions: [
          {
            id: 'approve-migration',
            title: 'Approve Migration',
            description: 'Approve the gated migration for this release.',
            toolId: 'approve-migration-run',
            surface: 'task-center',
            reason: 'Operator approved migration execution.',
            requiresConfirmation: true,
          },
        ],
        contextProviders: ['release-context'],
        surfaces: ['inline-card', 'task-center'],
        permissions: {
          level: 'write',
          requiresAudit: true,
        },
      },
    ]);
    const plugin = runtimePlugins.find((item) => item.manifest.id === 'release-migration-guard');

    expect(plugin?.manifest.scope).toBe('release');
    expect(plugin?.manifest.resourceType).toBe('release');
    expect(plugin?.manifest.surface).toBe('release');
    expect(plugin?.manifest.actions[0]?.toolId).toBe('approve-migration-run');
  });
});
