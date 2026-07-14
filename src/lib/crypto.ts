import type { CipherGCM, CipherGCMTypes, DecipherGCM } from 'node:crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
const DEFAULT_KEY_VERSION = 1;
const keyCache = new Map<number, Buffer>();

export interface EncryptionOptions {
  aad?: string;
  keyVersion?: number;
}

export interface EncryptResult {
  encryptedValue: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function parseKeyVersion(value: string | undefined): number {
  if (!value) {
    return DEFAULT_KEY_VERSION;
  }

  const version = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('ENCRYPTION_MASTER_KEY_VERSION must be a positive integer');
  }
  return version;
}

export function getCurrentEncryptionKeyVersion(): number {
  return parseKeyVersion(process.env.ENCRYPTION_MASTER_KEY_VERSION);
}

function readKeyHex(version: number): string {
  const versionedKey = process.env[`ENCRYPTION_MASTER_KEY_V${version}`]?.trim();
  if (versionedKey) {
    return versionedKey;
  }

  if (version === getCurrentEncryptionKeyVersion()) {
    const currentKey = process.env.ENCRYPTION_MASTER_KEY?.trim();
    if (currentKey) {
      return currentKey;
    }
  }

  throw new Error(`Encryption master key version ${version} is not configured`);
}

export async function getMasterKey(version = getCurrentEncryptionKeyVersion()): Promise<Buffer> {
  const cached = keyCache.get(version);
  if (cached) {
    return cached;
  }

  const keyHex = readKeyHex(version);
  if (!/^[a-f0-9]{64}$/iu.test(keyHex)) {
    throw new Error(`Encryption master key version ${version} must be a 64-character hex string`);
  }

  const key = Buffer.from(keyHex, 'hex');
  keyCache.set(version, key);
  return key;
}

function applyAdditionalAuthenticatedData(target: CipherGCM | DecipherGCM, aad?: string): void {
  if (aad) {
    target.setAAD(Buffer.from(aad, 'utf8'));
  }
}

export async function encrypt(
  plaintext: string,
  options: EncryptionOptions = {}
): Promise<EncryptResult> {
  const keyVersion = options.keyVersion ?? getCurrentEncryptionKeyVersion();
  const key = await getMasterKey(keyVersion);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  applyAdditionalAuthenticatedData(cipher, options.aad);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    encryptedValue: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    keyVersion,
  };
}

export async function decrypt(
  encryptedValue: string,
  iv: string,
  authTag: string,
  options: EncryptionOptions = {}
): Promise<string> {
  const keyVersion = options.keyVersion ?? getCurrentEncryptionKeyVersion();
  const key = await getMasterKey(keyVersion);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  applyAdditionalAuthenticatedData(decipher, options.aad);
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function clearMasterKeyCache(): void {
  keyCache.clear();
}

export function generateMasterKey(): string {
  return randomBytes(32).toString('hex');
}
