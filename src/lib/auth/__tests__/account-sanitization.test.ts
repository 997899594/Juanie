import { describe, expect, it } from 'bun:test';
import { sanitizePersistedAuthAccount } from '@/lib/auth/account-sanitization';

describe('NextAuth account persistence', () => {
  it('removes provider credentials before the adapter writes an account', () => {
    expect(
      sanitizePersistedAuthAccount({
        provider: 'github',
        providerAccountId: 'github-user-1',
        type: 'oauth',
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        id_token: 'identity-secret',
        expires_at: 123,
      })
    ).toEqual({
      provider: 'github',
      providerAccountId: 'github-user-1',
      type: 'oauth',
      access_token: null,
      refresh_token: null,
      id_token: null,
      expires_at: 123,
    });
  });
});
