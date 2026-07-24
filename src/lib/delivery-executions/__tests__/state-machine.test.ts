import { describe, expect, it } from 'bun:test';
import {
  assertDeliveryExecutionTransition,
  isDeliveryExecutionTerminal,
} from '@/lib/delivery-executions/state-machine';

describe('delivery execution state machine', () => {
  it('accepts the source-to-production happy path', () => {
    const states = [
      'received',
      'dispatching',
      'building',
      'staging_releasing',
      'staging_verified',
      'awaiting_promotion',
      'production_releasing',
      'production_verified',
    ] as const;

    for (let index = 1; index < states.length; index += 1) {
      expect(() =>
        assertDeliveryExecutionTransition(states[index - 1], states[index])
      ).not.toThrow();
    }
  });

  it('allows idempotent signals and rejects regressions', () => {
    expect(() => assertDeliveryExecutionTransition('building', 'building')).not.toThrow();
    expect(() => assertDeliveryExecutionTransition('staging_verified', 'building')).toThrow(
      'cannot move'
    );
  });

  it('allows a zero-diff build to complete as a verified no-op', () => {
    expect(() =>
      assertDeliveryExecutionTransition('building', 'production_verified')
    ).not.toThrow();
  });

  it('allows a repository route to release directly to production', () => {
    expect(() =>
      assertDeliveryExecutionTransition('building', 'production_releasing')
    ).not.toThrow();
  });

  it('treats verified, failed, and canceled as terminal', () => {
    expect(isDeliveryExecutionTerminal('production_verified')).toBe(true);
    expect(isDeliveryExecutionTerminal('failed')).toBe(true);
    expect(isDeliveryExecutionTerminal('canceled')).toBe(true);
    expect(isDeliveryExecutionTerminal('awaiting_promotion')).toBe(false);
  });
});
