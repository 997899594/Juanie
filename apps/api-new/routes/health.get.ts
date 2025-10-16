import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  console.log('🔍 Health route accessed:', event.node.req.url)

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Health check passed',
    path: event.node.req.url,
    method: event.node.req.method,
  }
})
