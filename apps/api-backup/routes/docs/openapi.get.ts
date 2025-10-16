import { defineEventHandler, sendRedirect } from 'h3'
export default defineEventHandler((event) => {
  return sendRedirect(event, '/api/openapi.json', 302) // 更新路径
})
