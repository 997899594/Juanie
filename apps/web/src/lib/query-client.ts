import { QueryClient } from '@tanstack/vue-query'

/**
 * TanStack Query Client 配置
 *
 * 提供全局的查询和缓存配置
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据保持新鲜的时间 (5 分钟)
      staleTime: 1000 * 60 * 5,

      // 失败后重试次数
      retry: 1,

      // 窗口重新获得焦点时不自动重新获取
      refetchOnWindowFocus: false,

      // 网络重新连接时不自动重新获取
      refetchOnReconnect: false,

      // 组件挂载时不自动重新获取
      refetchOnMount: false,
    },
    mutations: {
      // Mutation 失败后重试次数
      retry: 0,
    },
  },
})
