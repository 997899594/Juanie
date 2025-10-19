import type { AppRouter } from '@juanie/api-new/src/trpc/trpc.service'
import { createTRPCProxyClient, httpBatchLink, loggerLink } from '@trpc/client'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * tRPC 客户端配置
 * 集成了调试支持，用于开发时调试tRPC请求
 */
export const trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> =
  createTRPCProxyClient<AppRouter>({
    links: [
      // 开发环境下启用日志记录
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
        colorMode: 'ansi',
      }),
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        // 允许跨域携带 Cookie（与服务端 CORS 的 Allow-Credentials 配置保持一致）
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            credentials: 'include',
          }),
        // 可以在这里添加认证头
        // headers() {
        //   return {
        //     authorization: getAuthCookie(),
        //   }
        // },
      }),
    ],
  })

export type { AppRouter }
