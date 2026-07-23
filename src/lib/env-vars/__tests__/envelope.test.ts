import { describe, expect, it } from 'bun:test';
import { clearMasterKeyCache } from '@/lib/crypto';
import { decryptEnvironmentSecret, encryptEnvironmentSecret } from '@/lib/env-vars/envelope';

const originalKey = process.env.ENCRYPTION_MASTER_KEY;
const originalVersion = process.env.ENCRYPTION_MASTER_KEY_VERSION;

function configureKeys(): void {
  process.env.ENCRYPTION_MASTER_KEY = '22'.repeat(32);
  process.env.ENCRYPTION_MASTER_KEY_VERSION = '2';
  clearMasterKeyCache();
}

function restoreKeys(): void {
  for (const [name, value] of [
    ['ENCRYPTION_MASTER_KEY', originalKey],
    ['ENCRYPTION_MASTER_KEY_VERSION', originalVersion],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  clearMasterKeyCache();
}

describe('environment secret envelopes', () => {
  it('binds a versioned envelope to the environment variable id', async () => {
    try {
      configureKeys();
      const encrypted = await encryptEnvironmentSecret('secret-value', 'variable-1');

      expect(encrypted.keyVersion).toBe(2);
      expect(
        await decryptEnvironmentSecret({
          ...encrypted,
          encryptionKeyVersion: encrypted.keyVersion,
        })
      ).toBe('secret-value');
      let rejectedWrongVariable = false;
      try {
        await decryptEnvironmentSecret({
          ...encrypted,
          id: 'variable-2',
          encryptionKeyVersion: encrypted.keyVersion,
        });
      } catch {
        rejectedWrongVariable = true;
      }
      expect(rejectedWrongVariable).toBe(true);
    } finally {
      restoreKeys();
    }
  });

  it('rejects envelopes without an explicit key version', async () => {
    let error: unknown;
    try {
      await decryptEnvironmentSecret({
        id: 'unversioned-variable',
        encryptedValue: '00',
        iv: '00',
        authTag: '00',
        encryptionKeyVersion: null,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof Error).toBe(true);
    if (!(error instanceof Error)) {
      throw new Error('Expected decryptEnvironmentSecret to reject an unversioned envelope');
    }
    expect(error.message).toContain('has no encryption key version');
  });
});
