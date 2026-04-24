import { describe, expect, it } from 'bun:test';
import { buildCopilotAuditMetadata } from '@/lib/ai/copilot/http';

describe('copilot http helpers', () => {
  it('builds stable audit metadata from a stream reply', () => {
    const metadata = buildCopilotAuditMetadata({
      projectId: 'project-1',
      environmentId: 'env-1',
      messageCount: 2,
      reply: {
        conversationId: 'conv-1',
        generatedAt: '2026-04-24T12:00:00.000Z',
        provider: '302.ai',
        model: 'gpt-5',
        suggestions: ['当前环境最该先看什么？'],
        skillId: 'environment-skill',
        promptKey: 'environment-copilot',
        promptVersion: 'v1',
        toolCalls: [
          {
            toolId: 'read-environment-context',
            scope: 'environment',
            riskLevel: 'read',
            reason: '读取环境总览',
          },
        ],
        usage: {
          inputTokens: 12,
          outputTokens: 34,
          totalTokens: 46,
        },
        stream: new ReadableStream<string>(),
      },
    });

    expect(metadata).toEqual({
      projectId: 'project-1',
      environmentId: 'env-1',
      messageCount: 2,
      conversationId: 'conv-1',
      provider: '302.ai',
      model: 'gpt-5',
      skillId: 'environment-skill',
      promptKey: 'environment-copilot',
      promptVersion: 'v1',
      toolCalls: [
        {
          toolId: 'read-environment-context',
          scope: 'environment',
          riskLevel: 'read',
          reason: '读取环境总览',
        },
      ],
      usage: {
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
      },
    });
  });
});
