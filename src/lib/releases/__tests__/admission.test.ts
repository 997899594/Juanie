import { describe, expect, it } from 'bun:test';
import {
  assertReleaseEntryPointAllowed,
  canCreateReleaseWithEntryPoint,
  ReleaseAdmissionError,
} from '@/lib/releases/admission';

describe('release admission', () => {
  it('blocks direct release entry points for promote-only environments', () => {
    const environment = {
      kind: 'production' as const,
      deliveryMode: 'promote_only' as const,
    };

    expect(canCreateReleaseWithEntryPoint(environment, 'repository_route')).toBe(false);
    expect(canCreateReleaseWithEntryPoint(environment, 'manual_release')).toBe(false);
    expect(canCreateReleaseWithEntryPoint(environment, 'promotion')).toBe(true);
    expect(canCreateReleaseWithEntryPoint(environment, 'rollback')).toBe(true);
  });

  it('allows preview launches only for preview environments', () => {
    expect(
      canCreateReleaseWithEntryPoint(
        {
          kind: 'preview',
          deliveryMode: 'direct',
        },
        'preview_launch'
      )
    ).toBe(true);

    expect(
      canCreateReleaseWithEntryPoint(
        {
          kind: 'persistent',
          deliveryMode: 'direct',
        },
        'preview_launch'
      )
    ).toBe(false);
  });

  it('raises a clear error when a direct release targets a promote-only environment', () => {
    expect(() =>
      assertReleaseEntryPointAllowed(
        {
          name: 'production',
          kind: 'production',
          deliveryMode: 'promote_only',
        },
        'manual_release'
      )
    ).toThrow(ReleaseAdmissionError);
  });
});
