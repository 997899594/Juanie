import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import {
  createError,
  defineEventHandler,
  getRequestURL,
  readBody,
  setHeader,
  setResponseStatus,
} from 'h3'
import { appRouter } from '@/routers'
import { createContext } from '@/trpc/context'

export default defineEventHandler(async (event) => {
  try {
    const url = getRequestURL(event)
    const body =
      event.node.req.method !== 'GET' && event.node.req.method !== 'HEAD'
        ? await readBody(event).catch(() => null)
        : null

    // 将 Node 的 headers 转为 HeadersInit 兼容，避免直接断言导致类型/运行时问题
    const headersObject = Object.fromEntries(
      Object.entries(event.node.req.headers || {}).map(([key, val]) => [
        key,
        Array.isArray(val) ? val.join(', ') : (val ?? ''),
      ]),
    )

    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: new Request(url.toString(), {
        method: event.node.req.method || 'GET',
        headers: headersObject,
        body: body ? JSON.stringify(body) : undefined,
      }),
      router: appRouter,
      createContext: async () => {
        try {
          return await createContext(event)
        } catch (error) {
          console.error('Context creation error:', error)
          // 返回一个基本的上下文，避免完全失败
          return {
            req: event.node.req,
            res: event.node.res,
            authHeader: event.node.req.headers?.authorization,
            async getCurrentUser() {
              return null
            },
            async validateAuth() {
              return null
            },
            // 提供空的服务实例以避免错误
            healthService: null,
            trpcService: null,
            databaseService: null,
            authService: null,
          }
        }
      },
    })

    // 设置响应头
    for (const [key, value] of response.headers.entries()) {
      setHeader(event, key, value)
    }

    // 设置状态码
    setResponseStatus(event, response.status)

    // 返回响应体（tRPC 返回 JSON 文本）
    return await response.text()
  } catch (error) {
    console.error('tRPC handler error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})
