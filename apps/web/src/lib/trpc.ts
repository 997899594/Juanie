import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from '@trpc/client'
import type { AppRouter } from '@/../../api-gateway/src/trpc/trpc.router'

// 获取 API 基础 URL
const getBaseUrl = () => {
  // 如果显式指定了 API 地址，则使用该地址（适用于生产或非代理场景）
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // 开发环境走同源 + Vite 代理，避免 CORS；返回空串以构建相对路径
  return ''
}

// 创建 tRPC 客户端
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      // 请求头配置
      headers() {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // 添加认证 Token
        const sessionToken = localStorage.getItem('sessionToken')
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`
        }

        // 添加 session ID（兼容旧版）
        const sessionId = localStorage.getItem('sessionId')
        if (sessionId) {
          headers['x-session-id'] = sessionId
        }

        return headers
      },
      // 请求拦截器 - 全局错误处理
      async fetch(url, options) {
        try {
          const response = await fetch(url, {
            ...options,
            credentials: 'include', // 包含 cookies
          })

          // 处理认证错误
          if (response.status === 401) {
            // 清除本地认证信息
            localStorage.removeItem('sessionToken')
            localStorage.removeItem('sessionId')

            // 如果不在登录页，跳转到登录页
            if (!window.location.pathname.includes('/login')) {
              window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
            }
          }

          return response
        } catch (error) {
          // 网络错误处理
          console.error('Network error:', error)
          throw error
        }
      },
    }),
  ],
})

// 导出类型
export type { AppRouter }

// 导出错误类型判断工具
export function isTRPCClientError(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError
}
