/**
 * 加密工具 (Core 层 - 纯函数)
 *
 * 使用 AES-256-GCM 加密算法
 * 基于 Node.js 内置 crypto 模块
 *
 * @example
 * ```typescript
 * import { encrypt, decrypt, getEncryptionKey } from '@juanie/core/encryption'
 * import { ConfigService } from '@nestjs/config'
 *
 * class MyService {
 *   constructor(private config: ConfigService) {}
 *
 *   encryptData(data: string) {
 *     const key = getEncryptionKey(this.config)
 *     return encrypt(data, key)
 *   }
 * }
 * ```
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * 加密错误
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly operation: 'encrypt' | 'decrypt' | 'key',
  ) {
    super(message)
    this.name = 'EncryptionError'
  }
}

/**
 * 从配置获取加密密钥
 *
 * @param config - NestJS ConfigService 或任何有 get 方法的对象
 * @returns 加密密钥
 * @throws {EncryptionError} 如果密钥未配置
 */
export function getEncryptionKey(config: { get: (key: string) => string | undefined }): string {
  const key = config.get('ENCRYPTION_KEY')
  if (!key) {
    throw new EncryptionError('ENCRYPTION_KEY is not configured', 'key')
  }
  return key
}

/**
 * 确保密钥是 32 字节
 */
function ensureKeyLength(key: string): Buffer {
  if (!key || key.length === 0) {
    throw new EncryptionError('Encryption key is required', 'key')
  }
  // 填充或截断到 32 字节
  return Buffer.from(key.padEnd(32, '0').slice(0, 32))
}

/**
 * 加密数据
 *
 * @param plaintext - 要加密的明文
 * @param key - 加密密钥（任意长度，会自动调整为 32 字节）
 * @returns 加密后的密文（格式: iv:authTag:ciphertext）
 *
 * @throws {EncryptionError} 加密失败时抛出
 */
export function encrypt(plaintext: string, key: string): string {
  try {
    const keyBuffer = ensureKeyLength(key)
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // 格式: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    throw new EncryptionError(
      error instanceof Error ? error.message : 'Encryption failed',
      'encrypt',
    )
  }
}

/**
 * 解密数据
 *
 * @param ciphertext - 要解密的密文（格式: iv:authTag:ciphertext）
 * @param key - 解密密钥（必须与加密时使用的密钥相同）
 * @returns 解密后的明文
 *
 * @throws {EncryptionError} 解密失败时抛出
 */
export function decrypt(ciphertext: string, key: string): string {
  try {
    const keyBuffer = ensureKeyLength(key)
    const parts = ciphertext.split(':')

    if (parts.length !== 3) {
      throw new EncryptionError('Invalid ciphertext format', 'decrypt')
    }

    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex!, 'hex')
    const authTag = Buffer.from(authTagHex!, 'hex')

    const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
    decipher.setAuthTag(authTag)

    const decrypted = decipher.update(encrypted!, 'hex', 'utf8') + decipher.final('utf8')

    return decrypted
  } catch (error) {
    throw new EncryptionError(
      error instanceof Error ? error.message : 'Decryption failed',
      'decrypt',
    )
  }
}

/**
 * 测试加密/解密功能
 *
 * @param key - 测试用的密钥
 * @returns 测试是否成功
 */
export function testEncryption(key: string): boolean {
  try {
    const testData = `test-${Date.now()}`
    const encrypted = encrypt(testData, key)
    const decrypted = decrypt(encrypted, key)
    return testData === decrypted
  } catch {
    return false
  }
}
