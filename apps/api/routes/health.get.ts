import { defineEventHandler, sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
  // 将健康检查端点重定向到 tRPC 的 health.ping
  return sendRedirect(event, '/trpc/health.ping', 302)
})
