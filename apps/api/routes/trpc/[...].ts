import { Readable } from 'node:stream'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createError, defineEventHandler, getRequestURL, setHeader, setResponseStatus } from 'h3'
import { createContext } from '@/lib/trpc/context'
import { appRouter } from '@/routers'

export default defineEventHandler(async (event) => {
  try {
    const url = getRequestURL(event)

    const headersObject = Object.fromEntries(
      Object.entries(event.node.req.headers || {}).map(([key, val]) => [
        key,
        Array.isArray(val) ? val.join(', ') : (val ?? ''),
      ]),
    )

    const method = event.node.req.method || 'GET'
    const hasBody = method !== 'GET' && method !== 'HEAD'

    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: new Request(url.toString(), {
        method,
        headers: headersObject,
        ...(hasBody ? { body: Readable.toWeb(event.node.req) as any } : {}),
      }),
      router: appRouter,
      createContext: (_opts) => createContext({ req: event.node.req, resHeaders: {} }),
    })

    // 设置响应头
    for (const [key, value] of response.headers.entries()) {
      setHeader(event, key, value)
    }

    // 设置状态码
    setResponseStatus(event, response.status)

    // 返回响应体（tRPC 返回 JSON 文本）
    return await response.json()
  } catch (error) {
    console.error('tRPC handler error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})
