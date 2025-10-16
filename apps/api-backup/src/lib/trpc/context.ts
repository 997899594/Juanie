/**
 * tRPC 上下文创建器
 * 使用 NestJS 官方推荐的服务获取方式
 */

import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone'
import { DrizzleService } from '@/drizzle/drizzle.service'
import { AuthService } from '@/modules/auth/services/auth.service'
import { GitService } from '@/modules/git/services/git.service'
import { HealthService } from '@/modules/health/services/health.service'
import { getService } from '../utils/nest-service'

export interface Context {
  authService: AuthService
  drizzleService: DrizzleService
  healthService: HealthService
  gitService: GitService
}

export async function createContext(opts: CreateHTTPContextOptions): Promise<Context> {
  // 使用 NestJS 官方推荐的服务获取方式
  const authService = getService(AuthService)
  const healthService = getService(HealthService)
  const gitService = getService(GitService)
  const drizzleService = getService(DrizzleService)

  return {
    authService,
    drizzleService,
    healthService,
    gitService,
  }
}

// 用于类型推断的辅助函数
export function createTRPCContext(
  authService: AuthService,
  drizzleService: DrizzleService,
  healthService: HealthService,
  gitService: GitService,
): Context {
  return {
    authService,
    drizzleService,
    healthService,
    gitService,
  }
}

async function extractUserFromRequest(
  req: H3Event['node']['req'],
  authService: ReturnType<typeof getAuthService>,
): Promise<User | undefined> {
  const token = extractTokenFromRequest(req)
  if (!token) return undefined

  try {
    const u = await authService.validateToken(token)
    return u ?? undefined
  } catch {
    return undefined
  }
}

function extractTokenFromRequest(req: H3Event['node']['req']): string | undefined {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  const cookieHeader = req.headers.cookie
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader)
    return cookies.session_token
  }

  return undefined
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce(
    (cookies, cookie) => {
      const [name, value] = cookie.trim().split('=')
      if (name && value) {
        cookies[name] = decodeURIComponent(value)
      }
      return cookies
    },
    {} as Record<string, string>,
  )
}
