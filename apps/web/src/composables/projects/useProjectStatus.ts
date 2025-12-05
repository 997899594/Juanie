import { log } from '@juanie/ui'
import { useQuery } from '@tanstack/vue-query'
import { useToast } from '@/composables/useToast'
import { isTRPCClientError, trpc } from '@/lib/trpc'

/**
 * 项目状态和健康度管理 (TanStack Query)
 */
export function useProjectStatus() {
  const toast = useToast()

  /**
   * 获取项目状态
   */
  function useStatusQuery(projectId: string) {
    return useQuery({
      queryKey: ['projects', 'status', projectId],
      queryFn: async () => {
        try {
          return await trpc.projects.getStatus.query({ projectId })
        } catch (err) {
          log.error('Failed to get project status:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取项目状态失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 30, // 30 秒 - 状态变化较快
      enabled: !!projectId,
    })
  }

  /**
   * 获取项目健康度
   */
  function useHealthQuery(projectId: string) {
    return useQuery({
      queryKey: ['projects', 'health', projectId],
      queryFn: async () => {
        try {
          return await trpc.projects.getHealth.query({ projectId })
        } catch (err) {
          log.error('Failed to get project health:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取项目健康度失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60, // 1 分钟
      enabled: !!projectId,
    })
  }

  return {
    useStatusQuery,
    useHealthQuery,
  }
}
