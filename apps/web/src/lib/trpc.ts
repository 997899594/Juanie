import type { AppRouter } from '@juanie/api-new'
import { createTRPCProxyClient, httpBatchLink, loggerLink, type TRPCClient } from '@trpc/client'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// 创建 tRPC 客户端
const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({
      enabled: () => import.meta.env.DEV,
    }),
    httpBatchLink({
      url: `${baseUrl}/trpc`,
      fetch: (url: RequestInfo | URL, options?: RequestInit) =>
        fetch(url, {
          ...options,
          credentials: 'include',
        }),
      // headers() {
      //   const token = localStorage.getItem('token')
      //   return token ? { authorization: `Bearer ${token}` } : {}
      // },
    }),
  ],
})

// 导出 tRPC 客户端，使用正确的类型定义
export const trpc: TRPCClient<AppRouter> = trpcClient

export type { AppRouter }
