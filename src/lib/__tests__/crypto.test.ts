import { describe, expect, it } from 'bun:test';
import { clearMasterKeyCache, decrypt, encrypt } from '@/lib/crypto';

const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;
const originalMasterKeyVersion = process.env.ENCRYPTION_MASTER_KEY_VERSION;

function restoreEnvironment(): void {
  if (originalMasterKey === undefined) {
    delete process.env.ENCRYPTION_MASTER_KEY;
  } else {
    process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
  }
  if (originalMasterKeyVersion === undefined) {
    delete process.env.ENCRYPTION_MASTER_KEY_VERSION;
  } else {
    process.env.ENCRYPTION_MASTER_KEY_VERSION = originalMasterKeyVersion;
  }
  clearMasterKeyCache();
}

describe('versioned envelope encryption', () => {
  it('binds ciphertext to its context and records the key version', async () => {
    try {
      process.env.ENCRYPTION_MASTER_KEY = '11'.repeat(32);
      process.env.ENCRYPTION_MASTER_KEY_VERSION = '7';
      clearMasterKeyCache();

      const encrypted = await encrypt('provider-token', { aad: 'grant:grant-1:access' });

      expect(encrypted.keyVersion).toBe(7);
      expect(
        await decrypt(encrypted.encryptedValue, encrypted.iv, encrypted.authTag, {
          aad: 'grant:grant-1:access',
          keyVersion: encrypted.keyVersion,
        })
      ).toBe('provider-token');

      let rejectedWrongContext = false;
      try {
        await decrypt(encrypted.encryptedValue, encrypted.iv, encrypted.authTag, {
          aad: 'grant:grant-2:access',
          keyVersion: encrypted.keyVersion,
        });
      } catch {
        rejectedWrongContext = true;
      }
      expect(rejectedWrongContext).toBe(true);
    } finally {
      restoreEnvironment();
    }
  });
});
