import { nanoid } from 'nanoid'

/**
 * 生成唯一 ID
 * @param size - ID 长度，默认 21
 * @returns 唯一 ID 字符串
 */
export function generateId(size?: number): string {
  return nanoid(size)
}

/**
 * 生成短 ID（用于 URL 友好的标识符）
 * @returns 10 位短 ID
 */
export function generateShortId(): string {
  return nanoid(10)
}

/**
 * 生成会话 ID
 * @returns 32 位会话 ID
 */
export function generateSessionId(): string {
  return nanoid(32)
}

/**
 * 生成 OAuth state
 * @returns 16 位 state 字符串
 */
export function generateOAuthState(): string {
  return nanoid(16)
}
