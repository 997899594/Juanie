import type { NitroAppPlugin } from 'nitropack'
import { logger } from '../src/middleware/logger.middleware'

const plugin: NitroAppPlugin = (nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context = event.context || {}
    event.context._start = Date.now()
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const start = event.context?._start || Date.now()
    const duration = Date.now() - start

    const method = event.node.req.method || ''
    const path = event.path || event.node.req.url || ''
    const statusCode = event.node.res.statusCode
    const uaHeader = event.node.req.headers['user-agent']
    const userAgent = typeof uaHeader === 'string' ? uaHeader : undefined
    const ip = event.node.req.socket?.remoteAddress

    logger.logApiRequest({
      method,
      path,
      duration,
      statusCode,
      userAgent,
      ip,
    })
  })

  nitroApp.hooks.hook('error', (error, { event }) => {
    logger.error('HTTP error', {
      error: error instanceof Error ? error.message : String(error),
      method: event?.node.req.method,
      path: event?.path || event?.node.req.url,
    })
  })
}

export default plugin
