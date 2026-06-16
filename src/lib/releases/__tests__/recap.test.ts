import { describe, expect, it } from 'bun:test';
import { buildReleaseRecap } from '@/lib/releases/recap';

describe('release recap', () => {
  it('uses lifecycle priority when failed and rollout deployment states coexist', () => {
    const recap = buildReleaseRecap({
      id: 'rel-1',
      status: 'awaiting_rollout',
      environment: {
        id: 'env-prod',
        name: 'production',
        isProduction: true,
        isPreview: false,
      },
      artifacts: [{ kind: 'image', service: { id: 'svc-worker', name: 'worker' } }],
      deployments: [
        { status: 'awaiting_rollout' },
        {
          status: 'verification_failed',
          errorMessage: 'worker exited with code 1',
        },
        {
          status: 'canceled',
          errorMessage: 'Canceled pending rollout because another service in this release failed',
        },
      ],
      migrationRuns: [],
    });

    expect(recap.blockingReason?.label).toBe('校验失败');
    expect(recap.blockingReason?.summary).toBe(
      '候选版本没有通过运行态校验：worker exited with code 1'
    );
    expect(recap.blockingReason?.nextActionLabel).toBe('补齐环境变量或修复启动错误后重试发布');
    expect(recap.headline).toContain('校验失败');
  });
});
