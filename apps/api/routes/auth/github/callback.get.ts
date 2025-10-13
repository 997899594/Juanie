import {
  createError,
  defineEventHandler,
  getClientIP,
  getCookie,
  getHeader,
  getQuery,
  setCookie,
} from 'h3'
import { getAppContainer } from '../../../src/nest'

export default defineEventHandler(async (event) => {
  const { authService } = getAppContainer()

  const { code, state } = getQuery(event) as Record<string, string>
  const savedState = getCookie(event, 'oauth_state')
  const codeVerifier = getCookie(event, 'oauth_code_verifier')

  // 验证 state 参数
  if (!code || !state || !savedState || !codeVerifier) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth callback' })
  }

  if (!authService.constantTimeCompare(state, savedState)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid state parameter' })
  }

  try {
    // 验证授权码并获取用户信息
    const profile = await authService.validateGitHubCallback(code, codeVerifier)

    // 创建或更新用户
    const user = await authService.upsertOAuthAccount('github', String(profile.id), profile)

    // 创建会话
    const userAgent = getHeader(event, 'user-agent')
    const ipAddress = getClientIP(event)
    const sessionId = await authService.createSession(user.id, userAgent, ipAddress)

    // 设置会话 Cookie
    setCookie(event, 'session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: '/',
    })

    // 清理临时 Cookie
    setCookie(event, 'oauth_state', '', { maxAge: 0, path: '/' })
    setCookie(event, 'oauth_code_verifier', '', { maxAge: 0, path: '/' })

    return { success: true, user: { id: user.id, email: user.email, name: user.name } }
  } catch (error) {
    throw createError({ statusCode: 500, statusMessage: 'OAuth callback failed' })
  }
})
