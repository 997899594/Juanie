import { describe, expect, it } from 'bun:test';
import { canReleaseAcceptRolloutActions } from '@/lib/releases/state-machine';

describe('release state machine', () => {
  it('accepts rollout actions only while the release is awaiting rollout', () => {
    expect(canReleaseAcceptRolloutActions('awaiting_rollout')).toBe(true);
    expect(canReleaseAcceptRolloutActions('failed')).toBe(false);
    expect(canReleaseAcceptRolloutActions('verification_failed')).toBe(false);
    expect(canReleaseAcceptRolloutActions('succeeded')).toBe(false);
    expect(canReleaseAcceptRolloutActions(null)).toBe(false);
  });
});
