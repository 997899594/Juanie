import { describe, expect, it } from 'bun:test';
import { buildProjectInitOverview } from '@/lib/projects/init-view';

describe('project init view', () => {
  it('surfaces queue dispatch failures as retryable initialization errors', () => {
    const overview = buildProjectInitOverview([
      {
        id: 'step-1',
        step: 'validate_repository',
        status: 'failed',
        message: '初始化任务未成功写入队列，请稍后重试',
        progress: 0,
        errorCode: 'init_enqueue_failed',
        error: 'Queue unavailable',
      },
    ]);

    expect(overview.status).toBe('failed');
    expect(overview.primarySummary).toContain('Queue unavailable');
    expect(overview.nextActionLabel).toContain('稍后重试初始化');
    expect(overview.recoveryAction).toEqual({
      kind: 'retry',
      label: '重新执行初始化',
    });
  });
});
