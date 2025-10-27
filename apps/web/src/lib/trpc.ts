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

// 数据提取工具函数 - 简化多层嵌套的响应结构
export const extractData = <T>(response: any): T => {
  // 处理 tRPC 的标准响应格式: { success: true, data: T, timestamp: string }
  if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
    return response.data as T
  }
  // 如果已经是纯数据，直接返回
  return response as T
}

// 创建简化的 tRPC 客户端包装器
export const createSimplifiedTrpc = () => {
  const originalTrpc = trpcClient
  
  // 创建代理，自动提取 data 字段
  return new Proxy(originalTrpc, {
    get(target: any, prop: string) {
      const value = target[prop]
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(nestedTarget: any, nestedProp: string) {
            const nestedValue = nestedTarget[nestedProp]
            if (typeof nestedValue === 'object' && nestedValue !== null) {
              return new Proxy(nestedValue, {
                get(methodTarget: any, methodProp: string) {
                  const method = methodTarget[methodProp]
                  if (typeof method === 'function') {
                    return async (...args: any[]) => {
                      const result = await method.apply(methodTarget, args)
                      return extractData(result)
                    }
                  }
                  return method
                }
              })
            }
            return nestedValue
          }
        })
      }
      return value
    }
  })
}

// 导出简化的 tRPC 客户端
export const trpc = createSimplifiedTrpc() as TRPCClient<AppRouter>

// 导出原始客户端（如果需要完整响应格式）
export const trpcRaw: TRPCClient<AppRouter> = trpcClient

export type { AppRouter }
