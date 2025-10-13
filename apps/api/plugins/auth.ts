import { createError, type EventHandlerRequest, getCookie, getRequestURL, type H3Event } from 'h3'
import type { NitroApp } from 'nitropack'
import { getAppContainer } from '@/nest'

export default async function (nitroApp: NitroApp) {
  nitroApp.hooks.hook('request', async (event: H3Event<EventHandlerRequest>) => {
    const { pathname } = getRequestURL(event)

    // 跳过不需要认证的路径
    if (
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/health') ||
      pathname.startsWith('/docs') ||
      pathname.startsWith('/scalar-docs') ||
      pathname.startsWith('/openapi')
    ) {
      return
    }

    const { authService, databaseService } = getAppContainer()

    // 从 Cookie 获取会话 ID
    const sessionId = getCookie(event, 'session')

    if (!sessionId) {
      throw createError({ statusCode: 401, statusMessage: 'No session found' })
    }

    // 验证会话
    const sessionData = await authService.validateSession(sessionId)

    if (!sessionData) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
    }

    // 获取用户信息
    const user = await databaseService.getUserById(sessionData.userId)

    if (!user) {
      await authService.destroySession(sessionId)
      throw createError({ statusCode: 401, statusMessage: 'User not found' })
    }

    // 将用户信息添加到上下文
    event.context.user = user
    event.context.session = sessionData
  })
}
