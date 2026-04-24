import { describe, expect, it } from 'bun:test';
import {
  buildEnvironmentTaskCenterSnapshot,
  type EnvironmentTaskItem,
  sortEnvironmentTasks,
} from '@/lib/ai/tasks/environment-task-center';

describe('environment task center', () => {
  it('sorts tasks by operational priority', () => {
    const tasks: EnvironmentTaskItem[] = [
      {
        id: 'schema',
        kind: 'schema_repair',
        title: 'Schema',
        summary: 'schema repair',
        statusLabel: '待处理',
        actionLabel: '进入数据页',
        href: '/schema',
      },
      {
        id: 'failed',
        kind: 'migration_failed',
        title: 'Retry',
        summary: 'retry migration',
        statusLabel: '失败',
        actionLabel: '重试',
        href: '/schema',
      },
      {
        id: 'ai',
        kind: 'ai_analysis',
        title: 'AI',
        summary: 'deep analysis',
        statusLabel: '已完成',
        actionLabel: null,
        href: '/schema',
      },
      {
        id: 'approval',
        kind: 'migration_approval',
        title: 'Approve',
        summary: 'approve migration',
        statusLabel: '待审批',
        actionLabel: '审批通过',
        href: '/schema',
      },
    ];

    expect(sortEnvironmentTasks(tasks).map((task) => task.id)).toEqual([
      'approval',
      'failed',
      'ai',
      'schema',
    ]);
  });

  it('builds an empty snapshot cleanly', () => {
    expect(buildEnvironmentTaskCenterSnapshot([])).toEqual({
      summary: '当前环境没有待处理事项',
      actionableCount: 0,
      tasks: [],
    });
  });

  it('keeps AI task replay metadata in the snapshot', () => {
    const snapshot = buildEnvironmentTaskCenterSnapshot([
      {
        id: 'ai',
        kind: 'ai_analysis',
        title: 'AI',
        summary: 'deep analysis',
        statusLabel: '已完成',
        actionLabel: null,
        href: '/environment',
        inputSummary: '这个环境现在最该先处理什么？',
        detail: '先处理迁移审批，再看变量漂移。',
        provider: 'openai',
        model: 'gpt-5',
      },
    ]);

    expect(snapshot.tasks[0]?.id).toBe('ai');
    expect(snapshot.tasks[0]?.provider).toBe('openai');
    expect(snapshot.tasks[0]?.model).toBe('gpt-5');
    expect(snapshot.tasks[0]?.inputSummary).toBe('这个环境现在最该先处理什么？');
    expect(snapshot.tasks[0]?.detail).toBe('先处理迁移审批，再看变量漂移。');
  });
});
