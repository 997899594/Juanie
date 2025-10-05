// 文件默认导出：Nitro 插件

import { createError, eventHandler, getRequestURL } from 'h3'
import type { NitroAppPlugin } from 'nitropack'
import { logger } from '../src/middleware/logger.middleware'
import { createContext } from '../src/trpc/context'

const plugin: NitroAppPlugin = (nitroApp) => {
  nitroApp.h3App.use(
    eventHandler(async (event) => {
      const { pathname } = getRequestURL(event)
      // 仅保护 /panel/**，其他路径直接放行
      if (!pathname.startsWith('/panel/')) return

      try {
        const ctx = await createContext({ req: event.node.req, res: event.node.res })
        const user = await ctx.validateAuth()

        if (!user) {
          logger.logAuth('panel_access_denied', undefined, false)
          throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
        }

        logger.logAuth('panel_access_granted', user.id, true)
        // 认证通过放行
        return
      } catch (err) {
        logger.error('panel_access_error', {
          error: err instanceof Error ? err.message : String(err),
          path: pathname,
        })
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
      }
    }),
  )
}

export default plugin
