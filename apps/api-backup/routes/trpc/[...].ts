import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createError, defineEventHandler, setHeader, setResponseStatus } from 'h3'
import { createContext } from '@/lib/trpc/context'
import { appRouter } from '@/routers'

// 设置 CORS 头
function setCorsHeaders(event: any) {
  setHeader(event, 'Access-Control-Allow-Origin', 'http://localhost:5173')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
  setHeader(event, 'Access-Control-Allow-Credentials', 'true')
}

export default defineEventHandler(async (event) => {
  // 设置 CORS 头
  setCorsHeaders(event)

  // 处理 OPTIONS 请求
  if (event.node.req.method === 'OPTIONS') {
    setResponseStatus(event, 200)
    return ''
  }

  try {
    // 使用 tRPC 的 fetch 适配器处理请求
    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: event.node.req,
      router: appRouter,
      createContext: ({ req, resHeaders }) => createContext({ req, resHeaders }),
    })

    // 复制响应头
    for (const [key, value] of response.headers.entries()) {
      setHeader(event, key, value)
    }

    // 设置状态码
    setResponseStatus(event, response.status)

    // 返回响应体（tRPC 返回 JSON 文本）
    return await response.json()
  } catch (error) {
    // 增强错误日志记录
    console.error('🚨 tRPC 路由处理错误:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      method: event.node.req.method,
      url: event.node.req.url,
      headers: event.node.req.headers,
      timestamp: new Date().toISOString(),
      userAgent: event.node.req.headers?.['user-agent'],
    })

    // 确保错误响应也包含 CORS 头
    setCorsHeaders(event)

    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误，请稍后重试',
      data: {
        originalError: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      },
    })
  }
})
