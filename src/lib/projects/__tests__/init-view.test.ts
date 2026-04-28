import { describe, expect, it } from 'bun:test';
import { buildProjectInitOverview } from '@/lib/projects/init-view';

describe('project init view', () => {
  it('separates step status summary from operational detail', () => {
    const overview = buildProjectInitOverview([
      {
        id: 'step-1',
        step: 'validate_repository',
        status: 'running',
        message: '验证团队仓库授权',
        progress: 45,
        errorCode: null,
        error: null,
      },
      {
        id: 'step-2',
        step: 'setup_namespace',
        status: 'completed',
        message: '已登记 production 环境命名空间 juanie-prod',
        progress: 100,
        errorCode: null,
        error: null,
      },
    ]);

    expect(overview.steps[0]).toEqual({
      id: 'step-1',
      step: 'validate_repository',
      label: '验证仓库',
      status: 'running',
      progress: 45,
      errorCode: null,
      summary: '正在执行',
      detail: '验证团队仓库授权',
      error: null,
    });
    expect(overview.steps[1]).toEqual({
      id: 'step-2',
      step: 'setup_namespace',
      label: '创建命名空间',
      status: 'completed',
      progress: 100,
      errorCode: null,
      summary: '已完成',
      detail: '已登记 production 环境命名空间 juanie-prod',
      error: null,
    });
  });

  it('keeps failure status, retry detail and error separate', () => {
    const overview = buildProjectInitOverview([
      {
        id: 'step-1',
        step: 'validate_repository',
        status: 'failed',
        message: '平台将在稍后自动重试（下一次为第 2 次尝试）',
        progress: 0,
        errorCode: 'repository_access_denied',
        error: 'No access to repository',
      },
    ]);

    expect(overview.steps[0]).toEqual({
      id: 'step-1',
      step: 'validate_repository',
      label: '验证仓库',
      status: 'failed',
      progress: 0,
      errorCode: 'repository_access_denied',
      summary: '执行失败',
      detail: '平台将在稍后自动重试（下一次为第 2 次尝试）',
      error: 'No access to repository',
    });
  });

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
