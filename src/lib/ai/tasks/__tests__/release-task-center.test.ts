import { describe, expect, it } from 'bun:test';
import {
  buildReleaseTaskCenterSnapshot,
  sortReleaseTasks,
} from '@/lib/ai/tasks/release-task-center';

describe('release task center', () => {
  it('sorts actionable tasks by execution priority', () => {
    const tasks = sortReleaseTasks([
      {
        id: 'failed',
        kind: 'migration_failed',
        title: 'web · postgres',
        summary: 'migration failed',
        statusLabel: '失败',
        actionLabel: '重试',
      },
      {
        id: 'ai',
        kind: 'ai_analysis',
        title: 'AI deep analysis',
        summary: 'result',
        statusLabel: '已完成',
        actionLabel: null,
      },
      {
        id: 'external',
        kind: 'migration_external',
        title: 'worker · postgres',
        summary: 'waiting external completion',
        statusLabel: '待完成',
        actionLabel: '标记完成',
      },
      {
        id: 'approval',
        kind: 'migration_approval',
        title: 'api · postgres',
        summary: 'awaiting approval',
        statusLabel: '待审批',
        actionLabel: '审批通过',
      },
    ]);

    expect(tasks.map((task) => task.kind)).toEqual([
      'migration_approval',
      'migration_external',
      'migration_failed',
      'ai_analysis',
    ]);
  });

  it('builds an empty snapshot with concise summary', () => {
    expect(buildReleaseTaskCenterSnapshot([])).toEqual({
      summary: '当前发布没有待处理事项',
      actionableCount: 0,
      tasks: [],
    });
  });
});
