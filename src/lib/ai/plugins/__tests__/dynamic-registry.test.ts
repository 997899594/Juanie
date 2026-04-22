import { describe, expect, it } from 'bun:test';
import {
  extractDynamicPluginManifestsFromConfig,
  resolveDynamicPluginCatalog,
} from '@/lib/ai/plugins/dynamic-registry';

describe('dynamic plugin catalog', () => {
  it('merges built-in and dynamic manifests', () => {
    const catalog = resolveDynamicPluginCatalog({
      manifests: [
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
      ],
    });

    expect(catalog.dynamic.length).toBe(1);
    expect(catalog.all.map((manifest) => manifest.id)).toContain('team-custom-risk');
    expect(catalog.all.map((manifest) => manifest.id)).toContain('environment-summary');
  });

  it('rejects duplicate ids against built-in manifests', () => {
    expect(() =>
      resolveDynamicPluginCatalog({
        manifests: [
          {
            id: 'environment-summary',
            version: '1',
            title: 'dup',
            description: 'dup',
            kind: 'workspace',
            scope: 'environment',
            capabilities: [],
            skills: [],
            tools: [],
            actions: [],
            contextProviders: [],
            surfaces: [],
            permissions: {
              level: 'read',
              requiresAudit: true,
            },
          },
        ],
      })
    ).toThrow('Duplicate plugin manifest id: environment-summary');
  });

  it('extracts dynamic manifests from installation config payloads', () => {
    const manifests = extractDynamicPluginManifestsFromConfig({
      manifests: [
        {
          id: 'ops-mcp-plugin',
          version: '1',
          title: 'Ops MCP',
          description: 'Remote ops plugin.',
          kind: 'mcp',
          scope: 'project',
          capabilities: ['ops-read'],
          skills: ['environment-skill'],
          tools: ['read-environment-context'],
          actions: [
            {
              id: 'approve-migration',
              title: 'Approve Migration',
              description: 'Approve the current gated migration.',
              toolId: 'approve-migration-run',
              surface: 'task-center',
              reason: 'Operator approved migration execution.',
              requiresConfirmation: true,
            },
          ],
          contextProviders: ['environment-context'],
          surfaces: ['action-center'],
          permissions: {
            level: 'read',
            requiresAudit: true,
          },
        },
      ],
    });

    expect(manifests.length).toBe(1);
    expect(manifests[0]?.id).toBe('ops-mcp-plugin');
    expect(manifests[0]?.actions[0]?.toolId).toBe('approve-migration-run');
  });
});
