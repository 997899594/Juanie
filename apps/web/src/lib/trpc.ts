import {
  createTRPCProxyClient,
  httpBatchLink,
  httpSubscriptionLink,
  loggerLink,
  splitLink,
  TRPCClientError,
} from '@trpc/client'
import type { AppRouter } from '@/../../api-gateway/src/trpc/trpc.router'

// 获取 API 基础 URL
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  return 'http://localhost:3000'
}

// 创建 tRPC 客户端
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        import.meta.env.DEV || (opts.direction === 'down' && opts.result instanceof Error),
    }),
    // 使用 splitLink 分离 subscription 和普通请求
    splitLink({
      condition: (op) => op.type === 'subscription',
      // subscription 使用 SSE
      true: httpSubscriptionLink({
        url: `${getBaseUrl()}/trpc`,
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            credentials: 'include',
          }),
      }),
      // 普通请求使用 batch
      false: httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        async fetch(url, options) {
          try {
            const response = await fetch(url, {
              ...options,
              credentials: 'include',
            })

            if (response.status === 401) {
              if (!window.location.pathname.includes('/login')) {
                window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
              }
            }

            return response
          } catch (error) {
            console.error('Network error:', error)
            throw error
          }
        },
      }),
    }),
  ],
})

export type { AppRouter }

export function isTRPCClientError(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError
}
