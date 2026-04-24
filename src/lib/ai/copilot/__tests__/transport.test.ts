import { describe, expect, it } from 'bun:test';
import { createCopilotEventStream } from '@/lib/ai/copilot/transport';

describe('copilot transport', () => {
  it('wraps metadata and deltas into an SSE stream', async () => {
    const stream = createCopilotEventStream({
      metadata: {
        conversationId: 'copilot-conv-1',
        generatedAt: '2026-04-24T12:00:00.000Z',
        provider: '302.ai',
        model: 'gemini-2.5-flash',
        suggestions: ['当前环境最该先看什么？'],
        skillId: 'environment-skill',
        promptKey: 'environment-copilot',
        promptVersion: 'v1',
        toolCalls: [],
        usage: null,
      },
      textStream: new ReadableStream<string>({
        start(controller) {
          controller.enqueue('你好');
          controller.enqueue('世界');
          controller.close();
        },
      }),
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      output += decoder.decode(value, { stream: true });
    }

    output += decoder.decode();

    expect(output).toContain('event: meta');
    expect(output).toContain('"conversationId":"copilot-conv-1"');
    expect(output).toContain('"promptKey":"environment-copilot"');
    expect(output).toContain('event: delta');
    expect(output).toContain('"text":"你好"');
    expect(output).toContain('"text":"世界"');
    expect(output).toContain('event: done');
  });
});
