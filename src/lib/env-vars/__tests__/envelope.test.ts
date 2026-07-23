import { describe, expect, it } from 'bun:test';
import { clearMasterKeyCache, encrypt } from '@/lib/crypto';
import { decryptEnvironmentSecret, encryptEnvironmentSecret } from '@/lib/env-vars/envelope';
import { migrateUnversionedEnvironmentSecret } from '@/lib/env-vars/migration';

const originalKey = process.env.ENCRYPTION_MASTER_KEY;
const originalVersion = process.env.ENCRYPTION_MASTER_KEY_VERSION;
const originalLegacyKey = process.env.ENCRYPTION_MASTER_KEY_V0;

function configureKeys(): void {
  process.env.ENCRYPTION_MASTER_KEY = '22'.repeat(32);
  process.env.ENCRYPTION_MASTER_KEY_VERSION = '2';
  process.env.ENCRYPTION_MASTER_KEY_V0 = '11'.repeat(32);
  clearMasterKeyCache();
}

function restoreKeys(): void {
  for (const [name, value] of [
    ['ENCRYPTION_MASTER_KEY', originalKey],
    ['ENCRYPTION_MASTER_KEY_VERSION', originalVersion],
    ['ENCRYPTION_MASTER_KEY_V0', originalLegacyKey],
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

  it('re-encrypts legacy and N-1 envelopes with current versioned AAD', async () => {
    try {
      configureKeys();
      const legacy = await encrypt('legacy-value', { keyVersion: 0 });
      const currentUnversioned = await encrypt('current-value');

      const migratedLegacy = await migrateUnversionedEnvironmentSecret({
        id: 'legacy-variable',
        value: null,
        encryptedValue: legacy.encryptedValue,
        iv: legacy.iv,
        authTag: legacy.authTag,
      });
      const migratedCurrent = await migrateUnversionedEnvironmentSecret({
        id: 'current-variable',
        value: null,
        encryptedValue: currentUnversioned.encryptedValue,
        iv: currentUnversioned.iv,
        authTag: currentUnversioned.authTag,
      });

      expect(migratedLegacy.usedLegacyKey).toBe(true);
      expect(migratedCurrent.usedLegacyKey).toBe(false);
      for (const [expected, migrated] of [
        ['legacy-value', migratedLegacy],
        ['current-value', migratedCurrent],
      ] as const) {
        expect(migrated.envelope.keyVersion).toBe(2);
        expect(
          await decryptEnvironmentSecret({
            ...migrated.envelope,
            encryptionKeyVersion: migrated.envelope.keyVersion,
          })
        ).toBe(expected);
      }
    } finally {
      restoreKeys();
    }
  });
});
