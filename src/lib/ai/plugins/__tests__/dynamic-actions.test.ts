import { describe, expect, it } from 'bun:test';
import { resolveDynamicPluginActions } from '@/lib/ai/plugins/dynamic-actions';

describe('dynamic plugin actions', () => {
  it('marks write actions available when scope is satisfied', () => {
    const actions = resolveDynamicPluginActions(
      {
        id: 'ops-plugin',
        version: '1',
        title: 'Ops Plugin',
        description: 'Ops plugin',
        kind: 'workspace',
        scope: 'environment',
        capabilities: ['ops'],
        skills: ['environment-skill'],
        tools: ['read-environment-context'],
        actions: [
          {
            id: 'approve-migration',
            title: 'Approve Migration',
            description: 'Approve the migration gate.',
            toolId: 'approve-migration-run',
            surface: 'task-center',
            reason: 'Operator approved migration execution.',
            requiresConfirmation: true,
          },
        ],
        contextProviders: ['environment-context'],
        surfaces: ['task-center'],
        permissions: {
          level: 'write',
          requiresAudit: true,
        },
      },
      {
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-1',
      }
    );

    expect(actions[0]?.available).toBe(true);
    expect(actions[0]?.blockedReason).toBe(null);
  });

  it('blocks write actions when required scope is missing', () => {
    const actions = resolveDynamicPluginActions(
      {
        id: 'ops-plugin',
        version: '1',
        title: 'Ops Plugin',
        description: 'Ops plugin',
        kind: 'workspace',
        scope: 'environment',
        capabilities: ['ops'],
        skills: ['environment-skill'],
        tools: ['read-environment-context'],
        actions: [
          {
            id: 'approve-migration',
            title: 'Approve Migration',
            description: 'Approve the migration gate.',
            toolId: 'approve-migration-run',
            surface: 'task-center',
            reason: 'Operator approved migration execution.',
            requiresConfirmation: true,
          },
        ],
        contextProviders: ['environment-context'],
        surfaces: ['task-center'],
        permissions: {
          level: 'write',
          requiresAudit: true,
        },
      },
      {
        teamId: 'team-1',
        projectId: 'project-1',
      }
    );

    expect(actions[0]?.available).toBe(false);
    expect(actions[0]?.blockedReason).toContain('environment');
  });
});
