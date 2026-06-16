import { describe, expect, it } from 'bun:test';
import { resolveReleaseLifecycle } from '@/lib/releases/lifecycle';

describe('release lifecycle', () => {
  it('keeps verification failure as the release outcome over sibling rollout states', () => {
    const lifecycle = resolveReleaseLifecycle({
      status: 'awaiting_rollout',
      deployments: [
        {
          id: 'dep-web',
          status: 'awaiting_rollout',
        },
        {
          id: 'dep-worker',
          status: 'verification_failed',
          errorMessage: 'worker exited with code 1',
        },
        {
          id: 'dep-cron',
          status: 'canceled',
          errorMessage: 'Canceled pending rollout because another service in this release failed',
        },
      ],
    });

    expect(lifecycle.issue?.code).toBe('verification_failed');
    expect(lifecycle.failureSummary).toBe('worker exited with code 1');
    expect(lifecycle.resolution).toBe('failed');
    expect(lifecycle.terminal).toBe(true);
    expect(lifecycle.failed).toBe(true);
    expect(lifecycle.canAcceptRolloutActions).toBe(false);
    expect(lifecycle.actionableRolloutDeploymentIds).toEqual([]);
  });

  it('exposes rollout actions only for a clean awaiting-rollout release', () => {
    const lifecycle = resolveReleaseLifecycle({
      status: 'awaiting_rollout',
      deployments: [
        {
          id: 'dep-web',
          status: 'awaiting_rollout',
        },
        {
          id: 'dep-worker',
          status: 'running',
        },
      ],
    });

    expect(lifecycle.issue?.code).toBe('rollout_pending');
    expect(lifecycle.resolution).toBe('action_required');
    expect(lifecycle.failed).toBe(false);
    expect(lifecycle.canAcceptRolloutActions).toBe(true);
    expect(lifecycle.actionableRolloutDeploymentIds).toEqual(['dep-web']);
  });

  it('does not leak placeholder target names into migration summaries', () => {
    expect(
      resolveReleaseLifecycle({
        status: 'failed',
        migrationRuns: [{ status: 'failed' }],
      }).failureSummary
    ).toBe('迁移执行失败');

    expect(
      resolveReleaseLifecycle({
        status: 'failed',
        migrationRuns: [{ status: 'canceled' }],
      }).failureSummary
    ).toBe('迁移被取消');
  });
});
