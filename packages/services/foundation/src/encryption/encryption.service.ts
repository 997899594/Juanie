import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'

/**
 * 加密服务
 * 使用 AES-256-GCM 加密（Node.js 内置）
 * 用于加密敏感数据（如 Token、密钥等）
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name)
  private readonly algorithm = 'aes-256-gcm'

  /**
   * 获取加密密钥（32 字节）
   */
  private getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set')
    }
    // 确保密钥是 32 字节
    return Buffer.from(key.padEnd(32, '0').slice(0, 32))
  }

  /**
   * 加密数据
   */
  encrypt(plaintext: string): string {
    try {
      const key = this.getKey()
      const iv = randomBytes(16)
      const cipher = createCipheriv(this.algorithm, key, iv)

      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      const authTag = cipher.getAuthTag()

      // 格式: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
    } catch (error: any) {
      this.logger.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * 解密数据
   */
  decrypt(ciphertext: string): string {
    try {
      const key = this.getKey()
      const parts = ciphertext.split(':')

      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format')
      }

      const [ivHex, authTagHex, encrypted] = parts
      const iv = Buffer.from(ivHex!, 'hex')
      const authTag = Buffer.from(authTagHex!, 'hex')

      const decipher = createDecipheriv(this.algorithm, key, iv)
      decipher.setAuthTag(authTag)

      const decrypted = decipher.update(encrypted!, 'hex', 'utf8') + decipher.final('utf8')

      return decrypted
    } catch (error: any) {
      this.logger.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * 测试加密/解密
   */
  async test(): Promise<boolean> {
    try {
      const testData = `test-${Date.now()}`
      const encrypted = this.encrypt(testData)
      const decrypted = this.decrypt(encrypted)
      return testData === decrypted
    } catch {
      return false
    }
  }
}
