import { describe, expect, it } from 'bun:test';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import { getJuanieSkillById } from '@/lib/ai/skills/registry';
import { resolvePrimarySkill } from '@/lib/ai/skills/runtime';

describe('ai skill runtime', () => {
  it('loads first-party skill definitions from markdown assets', () => {
    const skill = getJuanieSkillById('environment-skill');

    expect(skill?.promptKey).toBe('environment-summary');
    expect(
      skill?.assetPath?.endsWith('src/lib/ai/skills/definitions/environment-skill/SKILL.md')
    ).toBe(true);
  });

  it('resolves a valid primary skill for a registered plugin contract', () => {
    const plugin: AIPlugin<unknown, unknown> = {
      manifest: {
        id: 'environment-summary',
        name: 'Environment Summary',
        title: 'Environment Summary',
        description: 'Environment summary plugin.',
        version: '1',
        tier: 'free',
        kind: 'core',
        scope: 'environment',
        surface: 'environment',
        surfaces: ['inline-card'],
        resourceType: 'environment',
        billingMetric: 'per_run',
        snapshotSchema: 'environment-summary-v1',
        cacheTtlSeconds: 600,
        supportsManualRefresh: true,
        eventTriggers: [],
        capabilities: [],
        skills: ['environment-skill'],
        tools: [
          'read-environment-context',
          'read-environment-variables',
          'read-environment-schema',
        ],
        actions: [],
        contextProviders: ['environment-context'],
        permissions: {
          level: 'read',
          requiresAudit: true,
        },
      },
      async isEnabled() {
        return true;
      },
      async buildEvidence() {
        return {};
      },
      async run() {
        return {
          output: {},
          provider: null,
          model: null,
          degradation: { degraded: false, reason: null, summary: null },
        };
      },
    };

    const skill = resolvePrimarySkill(plugin);
    expect(skill?.id).toBe('environment-skill');
  });

  it('rejects plugins when required skill tools are missing', () => {
    const plugin: AIPlugin<unknown, unknown> = {
      manifest: {
        id: 'environment-summary',
        name: 'Environment Summary',
        title: 'Environment Summary',
        description: 'Environment summary plugin.',
        version: '1',
        tier: 'free',
        kind: 'core',
        scope: 'environment',
        surface: 'environment',
        surfaces: ['inline-card'],
        resourceType: 'environment',
        billingMetric: 'per_run',
        snapshotSchema: 'environment-summary-v1',
        cacheTtlSeconds: 600,
        supportsManualRefresh: true,
        eventTriggers: [],
        capabilities: [],
        skills: ['environment-skill'],
        tools: ['read-environment-context'],
        actions: [],
        contextProviders: ['environment-context'],
        permissions: {
          level: 'read',
          requiresAudit: true,
        },
      },
      async isEnabled() {
        return true;
      },
      async buildEvidence() {
        return {};
      },
      async run() {
        return {
          output: {},
          provider: null,
          model: null,
          degradation: { degraded: false, reason: null, summary: null },
        };
      },
    };

    expect(() => resolvePrimarySkill(plugin)).toThrow('missing skill tool');
  });
});
