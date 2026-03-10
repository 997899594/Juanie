import { describe, expect, it, mock } from 'bun:test';

const revokeActiveGrantsMock = mock(async () => ({ ok: true as const, count: 1 }));

mock.module('@/lib/integrations/service/grant-service', () => ({
  revokeActiveGrants: revokeActiveGrantsMock,
  upsertGrantFromOAuth: mock(async () => ({ ok: true as const })),
}));

describe('auth integration hooks', () => {
  it('calls revoke flow on sign out', async () => {
    const { onAuthSignOut } = await import('@/lib/auth');
    const result = await onAuthSignOut('user-1');

    expect(revokeActiveGrantsMock).toHaveBeenCalledWith('user-1');
    expect(result.ok).toBe(true);
  });
});
