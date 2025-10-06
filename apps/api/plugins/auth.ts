// 顶部导入
import {
  createError,
  type EventHandlerRequest,
  getHeader,
  getRequestURL,
  type H3Event,
  sendError,
} from 'h3'
import type { NitroApp } from 'nitropack'
import { getAppContainer } from '@/nest'
import { logger } from '../src/middleware/logger.middleware'

export default async function (nitroApp: NitroApp) {
  nitroApp.hooks.hook('request', async (event: H3Event<EventHandlerRequest>) => {
    const { pathname } = getRequestURL(event)
    // 只在访问文档相关路由时进行鉴权
    if (
      pathname.startsWith('/docs') ||
      pathname.startsWith('/scalar-docs') ||
      pathname.startsWith('/openapi') ||
      pathname.startsWith('/health')
    ) {
      const { authService } = getAppContainer()
      const authHeader = getHeader(event, 'authorization')
      const user = await authService.validateRequest(authHeader)
      if (!user) {
        return sendError(event, createError({ statusCode: 401, statusMessage: 'Unauthorized' }))
      }
      event.context.user = user
    }

    logger.logAuth('access_granted', event.context.user.id, true)
    return
  })
}
