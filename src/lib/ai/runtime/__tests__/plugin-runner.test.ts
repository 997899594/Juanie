import { describe, expect, it, mock } from 'bun:test';
import { createDegradationState } from '@/lib/ai/core/degradation';
import type { AIPlugin } from '@/lib/ai/runtime/types';

const recordAIRunTelemetryMock = mock(() => undefined);
const recordAIPluginUsageMock = mock(async () => undefined);
const createAuditLogMock = mock(async () => undefined);

mock.module('@/lib/ai/core/telemetry', () => ({
  recordAIRunTelemetry: recordAIRunTelemetryMock,
}));

mock.module('@/lib/ai/runtime/usage-service', () => ({
  recordAIPluginUsage: recordAIPluginUsageMock,
}));

mock.module('@/lib/audit', () => ({
  createAuditLog: createAuditLogMock,
}));

describe('ai plugin runner', () => {
  it('rejects plugins that reference an unknown skill', async () => {
    const { runAIPlugin } = await import('@/lib/ai/runtime/plugin-runner');

    const plugin: AIPlugin<{ ok: true }, { ok: true }> = {
      manifest: {
        id: 'broken-plugin',
        name: 'Broken Plugin',
        title: 'Broken Plugin',
        description: 'Broken plugin for test.',
        version: '1',
        tier: 'free',
        kind: 'workspace',
        scope: 'environment',
        surface: 'environment',
        surfaces: ['inline-card'],
        resourceType: 'environment',
        billingMetric: 'per_run',
        snapshotSchema: 'broken-v1',
        cacheTtlSeconds: 60,
        supportsManualRefresh: true,
        eventTriggers: [],
        capabilities: [],
        skills: ['missing-skill'],
        tools: [],
        actions: [],
        contextProviders: [],
        permissions: {
          level: 'read',
          requiresAudit: false,
        },
      },
      async isEnabled() {
        return true;
      },
      async buildEvidence() {
        return { ok: true };
      },
      async run() {
        return {
          output: { ok: true },
          provider: '302.ai',
          model: 'gemini-2.5-flash',
          degradation: createDegradationState(null),
        };
      },
    };

    try {
      await runAIPlugin({
        plugin,
        context: {
          teamId: 'team-1',
          projectId: 'project-1',
          environmentId: 'env-1',
        },
        plan: 'free',
      });
      throw new Error('expected runAIPlugin to throw');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message.includes('references unknown skill')).toBe(true);
    }
  });

  it('records resolved skill and prompt metadata for registered plugins', async () => {
    const { runAIPlugin } = await import('@/lib/ai/runtime/plugin-runner');

    const plugin: AIPlugin<{ ok: true }, { ok: true }> = {
      manifest: {
        id: 'environment-summary',
        name: 'Environment Summary',
        title: 'Environment Summary',
        description: 'Environment summary plugin for test.',
        version: '1',
        tier: 'free',
        kind: 'core',
        scope: 'environment',
        surface: 'environment',
        surfaces: ['inline-card'],
        resourceType: 'environment',
        billingMetric: 'per_run',
        snapshotSchema: 'environment-summary-v1',
        cacheTtlSeconds: 60,
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
        return { ok: true };
      },
      async run() {
        return {
          output: { ok: true },
          provider: '302.ai',
          model: 'gemini-2.5-flash',
          degradation: createDegradationState(null),
          skillId: 'environment-skill',
          promptKey: 'environment-summary',
          promptVersion: 'v1',
          outputSchema: 'environmentSummary',
          usage: {
            inputTokens: 42,
            outputTokens: 18,
            totalTokens: 60,
          },
        };
      },
    };

    await runAIPlugin({
      plugin,
      context: {
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        actorUserId: 'user-1',
      },
      plan: 'free',
    });

    const usageCall = (recordAIPluginUsageMock.mock?.calls ?? []).at(-1)?.[0] as
      | {
          actorUserId?: string | null;
          skillId?: string | null;
          promptKey?: string | null;
          promptVersion?: string | null;
          outputSchema?: string | null;
          toolCalls?: Array<{ toolId: string }>;
          usage?: {
            inputTokens: number | null;
            outputTokens: number | null;
            totalTokens: number | null;
          } | null;
        }
      | undefined;
    const auditCall = (createAuditLogMock.mock?.calls ?? []).at(-1)?.[0] as
      | {
          metadata?: {
            skillId?: string | null;
            promptKey?: string | null;
            promptVersion?: string | null;
            outputSchema?: string | null;
            toolCalls?: Array<{ toolId: string }>;
            usage?: {
              inputTokens: number | null;
              outputTokens: number | null;
              totalTokens: number | null;
            } | null;
          };
        }
      | undefined;

    expect(usageCall?.actorUserId).toBe('user-1');
    expect(usageCall?.skillId).toBe('environment-skill');
    expect(usageCall?.promptKey).toBe('environment-summary');
    expect(usageCall?.promptVersion).toBe('v1');
    expect(usageCall?.outputSchema).toBe('environmentSummary');
    expect(usageCall?.toolCalls).toEqual([]);
    expect(usageCall?.usage).toEqual({
      inputTokens: 42,
      outputTokens: 18,
      totalTokens: 60,
    });
    expect(auditCall?.metadata?.skillId).toBe('environment-skill');
    expect(auditCall?.metadata?.promptKey).toBe('environment-summary');
    expect(auditCall?.metadata?.promptVersion).toBe('v1');
    expect(auditCall?.metadata?.outputSchema).toBe('environmentSummary');
    expect(auditCall?.metadata?.toolCalls).toEqual([]);
    expect(auditCall?.metadata?.usage).toEqual({
      inputTokens: 42,
      outputTokens: 18,
      totalTokens: 60,
    });
  });

  it('rejects plugins when required scope context is missing', async () => {
    const { runAIPlugin } = await import('@/lib/ai/runtime/plugin-runner');

    const plugin: AIPlugin<{ ok: true }, { ok: true }> = {
      manifest: {
        id: 'environment-summary',
        name: 'Environment Summary',
        title: 'Environment Summary',
        description: 'Environment summary plugin for test.',
        version: '1',
        tier: 'free',
        kind: 'core',
        scope: 'environment',
        surface: 'environment',
        surfaces: ['inline-card'],
        resourceType: 'environment',
        billingMetric: 'per_run',
        snapshotSchema: 'environment-summary-v1',
        cacheTtlSeconds: 60,
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
          requiresAudit: false,
        },
      },
      async isEnabled() {
        return true;
      },
      async buildEvidence() {
        return { ok: true };
      },
      async run() {
        return {
          output: { ok: true },
          provider: '302.ai',
          model: 'gemini-2.5-flash',
          degradation: createDegradationState(null),
        };
      },
    };

    try {
      await runAIPlugin({
        plugin,
        context: {
          teamId: 'team-1',
          projectId: 'project-1',
        },
        plan: 'free',
      });
      throw new Error('expected runAIPlugin to throw');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain(
        'requires environmentId or previewEnvironmentId for environment scope'
      );
    }
  });
});
