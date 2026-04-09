import { describe, expect, it } from 'bun:test';
import { evaluateMemberRemovalImpact } from '@/lib/teams/offboarding-service';

describe('team offboarding impact', () => {
  it('blocks removing a user who owns the only default personal binding', () => {
    const result = evaluateMemberRemovalImpact({
      bindingSummaries: [
        {
          id: 'binding-1',
          authMode: 'personal',
          isDefault: true,
          sourceUserId: 'user-1',
        },
      ],
      targetUserId: 'user-1',
    });

    expect(result.blocking).toBe(true);
  });

  it('auto revokes non-default personal bindings for target member', () => {
    const result = evaluateMemberRemovalImpact({
      bindingSummaries: [
        {
          id: 'binding-1',
          authMode: 'personal',
          isDefault: false,
          sourceUserId: 'user-2',
        },
        {
          id: 'binding-2',
          authMode: 'service',
          isDefault: true,
          sourceUserId: 'bot-user',
        },
      ],
      targetUserId: 'user-2',
    });

    expect(result.blocking).toBe(false);
    expect(result.autoRevokeBindingIds).toEqual(['binding-1']);
  });

  it('ignores revoked personal bindings when evaluating removal impact', () => {
    const result = evaluateMemberRemovalImpact({
      bindingSummaries: [
        {
          id: 'binding-revoked-default',
          authMode: 'personal',
          isDefault: true,
          sourceUserId: 'user-3',
          revokedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'binding-revoked-non-default',
          authMode: 'personal',
          isDefault: false,
          sourceUserId: 'user-3',
          revokedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          id: 'binding-active-service',
          authMode: 'service',
          isDefault: true,
          sourceUserId: 'bot-user',
        },
      ],
      targetUserId: 'user-3',
    });

    expect(result.blocking).toBe(false);
    expect(result.autoRevokeBindingIds).toEqual([]);
  });
});
