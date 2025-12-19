import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * Git 同步管理 Composable (TanStack Query)
 */
export function useGitSync() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ==================== Queries ====================

  /**
   * 获取项目的同步日志
   */
  function useSyncLogsQuery(projectId: string, limit = 50) {
    return useQuery({
      queryKey: ['git-sync', 'logs', projectId, limit],
      queryFn: async () => {
        try {
          const result = await trpc.gitSync.getSyncLogs.query({ projectId, limit })
          return result.logs
        } catch (err) {
          log.error('Failed to fetch sync logs:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取同步日志失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 30, // 30 秒
      enabled: !!projectId,
    })
  }

  /**
   * 获取失败的同步任务
   */
  function useFailedSyncsQuery(projectId?: string) {
    return useQuery({
      queryKey: ['git-sync', 'failed-syncs', projectId],
      queryFn: async () => {
        try {
          const result = await trpc.gitSync.getFailedSyncs.query({ projectId })
          return result.logs
        } catch (err) {
          log.error('Failed to fetch failed syncs:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取失败任务失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60,
    })
  }

  // ==================== Mutations ====================

  /**
   * 重试失败的同步任务
   */
  const retrySyncMemberMutation = useMutation({
    mutationFn: async (syncLogId: string) => {
      return await trpc.gitSync.retrySyncMember.mutate({ syncLogId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'logs'] })
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'failed-syncs'] })
      toast.success('重试已触发', '正在重新同步...')
    },
    onError: (err) => {
      log.error('Failed to retry sync task:', err)
      if (isTRPCClientError(err)) {
        toast.error('重试失败', err.message)
      }
    },
  })

  /**
   * 批量重试失败的同步任务
   */
  const retryFailedSyncsMutation = useMutation({
    mutationFn: async (syncLogIds: string[]) => {
      return await trpc.gitSync.retryFailedSyncs.mutate({ syncLogIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'logs'] })
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'failed-syncs'] })
      toast.success('批量重试已触发', '正在重新同步...')
    },
    onError: (err) => {
      log.error('Failed to retry failed syncs:', err)
      if (isTRPCClientError(err)) {
        toast.error('批量重试失败', err.message)
      }
    },
  })

  return {
    // Queries
    useSyncLogsQuery,
    useFailedSyncsQuery,

    // Mutations
    retrySyncMember: retrySyncMemberMutation.mutateAsync,
    retrySyncMemberMutation,
    retryFailedSyncs: retryFailedSyncsMutation.mutateAsync,
    retryFailedSyncsMutation,
  }
}
