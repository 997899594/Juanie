import { describe, expect, it } from 'bun:test';
import { clearMasterKeyCache } from '@/lib/crypto';
import {
  decryptGrantAccessToken,
  encryptGrantCredentials,
} from '@/lib/integrations/service/grant-credentials';

const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;

function restoreEnvironment(): void {
  if (originalMasterKey === undefined) {
    delete process.env.ENCRYPTION_MASTER_KEY;
  } else {
    process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
  }
  delete process.env.ENCRYPTION_MASTER_KEY_VERSION;
  clearMasterKeyCache();
}

describe('integration grant credentials', () => {
  it('persists only contextual ciphertext and decrypts server-side', async () => {
    try {
      process.env.ENCRYPTION_MASTER_KEY = '22'.repeat(32);
      clearMasterKeyCache();

      const encrypted = await encryptGrantCredentials({
        grantId: '00000000-0000-0000-0000-000000000101',
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
      });

      expect(JSON.stringify(encrypted).includes('access-secret')).toBe(false);
      expect(JSON.stringify(encrypted).includes('refresh-secret')).toBe(false);
      expect(
        await decryptGrantAccessToken({
          id: '00000000-0000-0000-0000-000000000101',
          ...encrypted,
        })
      ).toBe('access-secret');
    } finally {
      restoreEnvironment();
    }
  });
});
