import { describe, expect, it } from 'bun:test';
import { handleAIAsyncTaskPost } from '@/lib/ai/tasks/route-helpers';
import { buildAITaskJobId } from '@/lib/queue';

const persistedTask = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'environment_deep_analysis' as const,
  title: 'Analyze environment',
  inputSummary: 'Analyze environment',
  resultSummary: null,
  errorMessage: null,
  provider: null,
  model: null,
  status: 'queued' as const,
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
  completedAt: null,
};

describe('AI task durable dispatch boundary', () => {
  it('accepts a persisted task when immediate Redis dispatch fails', async () => {
    const response = await handleAIAsyncTaskPost({
      request: new Request('http://localhost/tasks', {
        method: 'POST',
        body: JSON.stringify({ kind: 'deep_analysis', question: 'Analyze environment' }),
      }),
      createTask: async () => persistedTask,
      enqueueTask: async () => {
        throw new Error('Redis unavailable');
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      taskId: persistedTask.id,
      status: 'queued',
      summary: '已开始后台分析。',
    });
  });

  it('uses one rebuildable BullMQ identity per PostgreSQL task', () => {
    expect(buildAITaskJobId(persistedTask.id)).toBe(`ai-task-${persistedTask.id}`);
    expect(buildAITaskJobId(persistedTask.id)).toBe(buildAITaskJobId(persistedTask.id));
  });
});
