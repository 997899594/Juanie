/**
 * 认证辅助函数
 * 用于在测试中模拟认证
 */

import { randomUUID } from 'crypto'
import { createTestUser } from './db-helpers'

/**
 * 创建测试用户上下文（用于 tRPC）
 */
export async function createTestContext(userOverrides: Partial<any> = {}) {
  const user = await createTestUser(userOverrides)

  return {
    user,
    session: {
      id: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    },
  }
}

/**
 * 创建模拟的 JWT token
 */
export function createMockJWT(userId: string) {
  // 这是一个简化的 mock，实际测试中可能需要真实的 JWT
  return `mock-jwt-${userId}`
}

/**
 * 创建模拟的 OAuth 账号
 */
export function createMockOAuthAccount(userId: string, provider: 'github' | 'gitlab' = 'github') {
  return {
    id: randomUUID(),
    userId,
    provider,
    providerAccountId: `${provider}-${Date.now()}`,
    accessToken: `mock-access-token-${Date.now()}`,
    refreshToken: null,
    expiresAt: null,
    createdAt: new Date(),
  }
}

/**
 * 创建模拟的请求对象
 */
export function createMockRequest(user?: any) {
  return {
    headers: {
      authorization: user ? `Bearer ${createMockJWT(user.id)}` : undefined,
    },
    ip: '127.0.0.1',
    method: 'GET',
    url: '/test',
  }
}

/**
 * 创建模拟的响应对象
 */
export function createMockResponse() {
  return {
    headers: {},
    status: 200,
    setHeader: (key: string, value: string) => {
      // Mock implementation
    },
  }
}
