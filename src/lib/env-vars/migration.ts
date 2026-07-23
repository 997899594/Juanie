import { decrypt } from '@/lib/crypto';
import { encryptEnvironmentSecret, type NewEnvironmentSecretEnvelope } from './envelope';

export interface UnversionedEnvironmentSecret {
  id: string;
  value: string | null;
  encryptedValue: string | null;
  iv: string | null;
  authTag: string | null;
}

export interface MigratedEnvironmentSecret {
  envelope: NewEnvironmentSecretEnvelope;
  usedLegacyKey: boolean;
}

export async function migrateUnversionedEnvironmentSecret(
  variable: UnversionedEnvironmentSecret
): Promise<MigratedEnvironmentSecret> {
  let plaintext = variable.value;
  let usedLegacyKey = false;

  if (plaintext === null) {
    if (!variable.encryptedValue || !variable.iv || !variable.authTag) {
      throw new Error(`Secret environment variable ${variable.id} has no complete envelope`);
    }

    try {
      plaintext = await decrypt(variable.encryptedValue, variable.iv, variable.authTag);
    } catch (currentKeyError) {
      try {
        plaintext = await decrypt(variable.encryptedValue, variable.iv, variable.authTag, {
          keyVersion: 0,
        });
        usedLegacyKey = true;
      } catch {
        throw new Error(
          `Secret environment variable ${variable.id} cannot be authenticated with the current or legacy migration key`,
          { cause: currentKeyError }
        );
      }
    }
  }

  return {
    envelope: await encryptEnvironmentSecret(plaintext, variable.id),
    usedLegacyKey,
  };
}
