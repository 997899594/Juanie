import type { RateLimitService } from '@juanie/service-foundation'
import { TRPCError } from '@trpc/server'
import type { FastifyRequest } from 'fastify'

/**
 * 获取客户端 IP 地址
 */
function getClientIp(req?: FastifyRequest): string {
  if (!req) return 'unknown'

  // 优先从 X-Forwarded-For 获取（代理/负载均衡器）
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded
    return ips?.split(',')[0]?.trim() || 'unknown'
  }

  // 从 X-Real-IP 获取
  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] || 'unknown' : realIp || 'unknown'
  }

  // 从 socket 获取
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * 根据路径获取限流配置
 */
function getRateLimitConfig(
  path: string,
  sessionId?: string,
): {
  prefix: string
  limit: number
  window: number
  useUserId: boolean
} | null {
  // 登录相关端点：5 次/分钟（按 IP）
  if (
    path.startsWith('auth.login') ||
    path.startsWith('auth.githubCallback') ||
    path.startsWith('auth.gitlabCallback')
  ) {
    return {
      prefix: 'login',
      limit: 5,
      window: 60, // 60 秒
      useUserId: false, // 使用 IP
    }
  }

  // 已认证用户的 API 请求：100 次/分钟（按用户）
  if (sessionId) {
    return {
      prefix: 'api',
      limit: 100,
      window: 60, // 60 秒
      useUserId: true, // 使用用户 ID
    }
  }

  // 未认证用户的 API 请求：20 次/分钟（按 IP）
  return {
    prefix: 'api-public',
    limit: 20,
    window: 60, // 60 秒
    useUserId: false, // 使用 IP
  }
}

/**
 * 创建 Rate Limiting 中间件
 *
 * 防止暴力破解和 DDoS 攻击
 */
export function createRateLimitMiddleware(rateLimitService: RateLimitService) {
  return async (opts: any) => {
    const { ctx, path, type, next } = opts

    // 跳过订阅类型（subscription 不需要限流）
    if (type === 'subscription') {
      return next()
    }

    // 获取 IP 地址
    const ip = getClientIp(ctx.req)

    // 根据路径确定限流规则
    const rateLimitConfig = getRateLimitConfig(path, ctx.sessionId)

    if (!rateLimitConfig) {
      // 没有配置限流规则，直接通过
      return opts.next()
    }

    // 构建限流键
    const key =
      rateLimitConfig.useUserId && ctx.sessionId
        ? `${rateLimitConfig.prefix}:user:${ctx.sessionId}`
        : `${rateLimitConfig.prefix}:ip:${ip}`

    // 检查速率限制
    const result = await rateLimitService.checkRateLimit({
      key,
      limit: rateLimitConfig.limit,
      window: rateLimitConfig.window,
    })

    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `请求过于频繁，请稍后再试。重置时间: ${result.resetAt.toISOString()}`,
      })
    }

    return next()
  }
}
