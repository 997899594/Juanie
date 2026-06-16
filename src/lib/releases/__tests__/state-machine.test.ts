import { describe, expect, it } from 'bun:test';
import {
  canReleaseAcceptRolloutActions,
  resolveReleaseDeploymentResolution,
} from '@/lib/releases/state-machine';

describe('release state machine', () => {
  it('accepts rollout actions only while the release is awaiting rollout', () => {
    expect(canReleaseAcceptRolloutActions('awaiting_rollout')).toBe(true);
    expect(canReleaseAcceptRolloutActions('failed')).toBe(false);
    expect(canReleaseAcceptRolloutActions('verification_failed')).toBe(false);
    expect(canReleaseAcceptRolloutActions('succeeded')).toBe(false);
    expect(canReleaseAcceptRolloutActions(null)).toBe(false);
  });

  it('keeps the failing service as the release root cause when sibling rollout is canceled', () => {
    expect(
      resolveReleaseDeploymentResolution([
        {
          id: 'web',
          status: 'canceled',
          errorMessage: 'Canceled pending rollout because another service in this release failed',
        },
        {
          id: 'worker',
          status: 'verification_failed',
          errorMessage: 'ReplicaSet "worker-abc" is progressing.',
        },
      ])
    ).toEqual({
      kind: 'failed',
      failureStatus: 'verification_failed',
      message: 'ReplicaSet "worker-abc" is progressing.',
    });
  });
});
