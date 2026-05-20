import { describe, expect, it } from 'bun:test';
import {
  assertOidcClient,
  consumeAccessToken,
  consumeAuthorizationCode,
  createAccessToken,
  createAuthorizationCode,
  getOidcDiscovery,
  getOidcJwks,
} from '@/lib/oidc/provider';

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

describe('Juanie OIDC provider', () => {
  it('publishes standard discovery and JWKS metadata', () => {
    try {
      process.env.NEXTAUTH_URL = 'https://juanie.art';

      expect(getOidcDiscovery().issuer).toBe('https://juanie.art');
      expect(getOidcDiscovery().authorization_endpoint).toBe(
        'https://juanie.art/api/oidc/authorize'
      );
      expect(getOidcJwks().keys[0]?.kid).toBe('juanie-oidc');
    } finally {
      restoreEnv();
    }
  });

  it('signs and validates authorization codes and access tokens', () => {
    try {
      process.env.NEXTAUTH_SECRET = 'secret';
      process.env.BYTEBASE_OIDC_CLIENT_ID = 'bytebase';
      process.env.BYTEBASE_OIDC_CLIENT_SECRET = 'client-secret';

      assertOidcClient({ clientId: 'bytebase', clientSecret: 'client-secret' });

      const code = createAuthorizationCode({
        userId: 'user-1',
        clientId: 'bytebase',
        redirectUri: 'https://bytebase.juanie.art/oauth/callback',
        scope: 'openid email profile',
        nonce: 'nonce-1',
      });

      const codePayload = consumeAuthorizationCode({
        code,
        clientId: 'bytebase',
        redirectUri: 'https://bytebase.juanie.art/oauth/callback',
      });

      expect(codePayload.userId).toBe('user-1');
      expect(codePayload.nonce).toBe('nonce-1');

      const accessToken = createAccessToken({ userId: 'user-1', scope: codePayload.scope });
      expect(consumeAccessToken(accessToken).userId).toBe('user-1');
    } finally {
      restoreEnv();
    }
  });
});
