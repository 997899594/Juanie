/**
 * AES-256-GCM 加密工具
 *
 * 主密钥（Master Key）优先从平台自身的 K8s Secret（juanie-master-key）读取，
 * 开发环境 fallback 到 ENCRYPTION_MASTER_KEY 环境变量。
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const K8S_SECRET_NAMESPACE = 'juanie';
const K8S_SECRET_NAME = 'juanie-master-key';
const K8S_SECRET_KEY = 'masterKey';

// 缓存已加载的 master key（进程内单例）
let cachedMasterKey: Buffer | null = null;

/**
 * 获取 Master Key（32 字节 Buffer）
 * 1. 尝试从 K8s Secret 读取
 * 2. fallback 到 ENCRYPTION_MASTER_KEY 环境变量（hex 字符串）
 */
export async function getMasterKey(): Promise<Buffer> {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  // 1. 尝试从 K8s Secret 读取
  try {
    const { getK8sClient, getIsConnected } = await import('@/lib/k8s');
    if (getIsConnected()) {
      const { core } = getK8sClient();
      const secret = await core.readNamespacedSecret({
        namespace: K8S_SECRET_NAMESPACE,
        name: K8S_SECRET_NAME,
      });
      const keyBase64 = secret.data?.[K8S_SECRET_KEY];
      if (keyBase64) {
        const keyHex = Buffer.from(keyBase64, 'base64').toString('utf-8').trim();
        cachedMasterKey = Buffer.from(keyHex, 'hex');
        if (cachedMasterKey.length !== 32) {
          throw new Error(`Master key must be 32 bytes, got ${cachedMasterKey.length}`);
        }
        return cachedMasterKey;
      }
    }
  } catch (e) {
    // K8s 不可用时静默 fallback
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Failed to load master key from K8s Secret: ${(e as Error).message}`);
    }
  }

  // 2. Fallback：从环境变量读取（开发环境）
  const envKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!envKey) {
    throw new Error(
      'No encryption master key available. Set ENCRYPTION_MASTER_KEY env var or configure K8s Secret.'
    );
  }

  cachedMasterKey = Buffer.from(envKey, 'hex');
  if (cachedMasterKey.length !== 32) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must be a 64-char hex string (32 bytes), got ${cachedMasterKey.length} bytes`
    );
  }
  return cachedMasterKey;
}

export interface EncryptResult {
  encryptedValue: string; // hex
  iv: string; // hex（12 字节）
  authTag: string; // hex（16 字节）
}

/**
 * 使用 AES-256-GCM 加密明文字符串
 */
export async function encrypt(plaintext: string): Promise<EncryptResult> {
  const key = await getMasterKey();
  const iv = randomBytes(12); // 96-bit IV，GCM 标准推荐值
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 字节

  return {
    encryptedValue: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * 使用 AES-256-GCM 解密
 */
export async function decrypt(
  encryptedValue: string,
  iv: string,
  authTag: string
): Promise<string> {
  const key = await getMasterKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * 清除缓存的 master key（用于测试或密钥轮换后强制重新加载）
 */
export function clearMasterKeyCache(): void {
  cachedMasterKey = null;
}

/**
 * 生成一个新的随机 Master Key（用于初始化 K8s Secret）
 * 返回 64 字符 hex 字符串
 */
export function generateMasterKey(): string {
  return randomBytes(32).toString('hex');
}
