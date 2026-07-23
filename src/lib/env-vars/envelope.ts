import { randomUUID } from 'node:crypto';
import { decrypt, type EncryptResult, encrypt } from '@/lib/crypto';

export interface EnvironmentSecretEnvelope {
  id: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  encryptionKeyVersion: number | null;
}

export interface NewEnvironmentSecretEnvelope extends EncryptResult {
  id: string;
}

export function buildEnvironmentSecretAad(variableId: string): string {
  return `environment-variable:${variableId}`;
}

export async function encryptEnvironmentSecret(
  plaintext: string,
  variableId: string = randomUUID()
): Promise<NewEnvironmentSecretEnvelope> {
  const encrypted = await encrypt(plaintext, {
    aad: buildEnvironmentSecretAad(variableId),
  });
  return { id: variableId, ...encrypted };
}

export async function decryptEnvironmentSecret(
  envelope: EnvironmentSecretEnvelope
): Promise<string> {
  if (envelope.encryptionKeyVersion === null) {
    return decrypt(envelope.encryptedValue, envelope.iv, envelope.authTag);
  }

  return decrypt(envelope.encryptedValue, envelope.iv, envelope.authTag, {
    aad: buildEnvironmentSecretAad(envelope.id),
    keyVersion: envelope.encryptionKeyVersion,
  });
}
