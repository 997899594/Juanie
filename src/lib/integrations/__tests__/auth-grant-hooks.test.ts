import { describe, expect, it, mock } from 'bun:test';

const revokeActiveGrantsMock = mock(async () => ({ ok: true as const, count: 1 }));
const upsertGrantFromOAuthMock = mock(async () => ({ ok: true as const }));

mock.module('@/lib/integrations/service/grant-service', () => ({
  revokeActiveGrants: revokeActiveGrantsMock,
  upsertGrantFromOAuth: upsertGrantFromOAuthMock,
}));

describe('auth integration hooks', () => {
  it('keeps git grants active on sign out', async () => {
    const { onAuthSignOut } = await import('@/lib/auth');
    const result = await onAuthSignOut('user-1');

    expect(result.ok).toBe(true);
    const revokeCalls = revokeActiveGrantsMock.mock?.calls ?? [];
    expect(revokeCalls.length).toBe(0);
  });

  it('persists provider server metadata for oauth grants', async () => {
    const { onOAuthGrantPersist } = await import('@/lib/auth');

    await onOAuthGrantPersist({
      userId: 'user-1',
      provider: 'gitlab-self-hosted',
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: 1,
      scope: 'api',
      serverUrl: 'https://gitlab.example.com',
    });

    const calls = upsertGrantFromOAuthMock.mock?.calls ?? [];
    const lastCall = calls.at(-1)?.[0] as
      | {
          provider?: string;
          serverUrl?: string | null;
        }
      | undefined;
    expect(lastCall?.provider).toBe('gitlab-self-hosted');
    expect(lastCall?.serverUrl).toBe('https://gitlab.example.com');
  });
});
