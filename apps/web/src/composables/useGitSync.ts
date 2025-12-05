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
   * 获取用户的 Git 账号状态
   */
  function useGitAccountStatusQuery(provider?: 'github' | 'gitlab') {
    return useQuery({
      queryKey: ['git-sync', 'account-status', provider],
      queryFn: async () => {
        try {
          const result = await trpc.gitSync.getGitAccountStatus.query({ provider })
          return result.accounts
        } catch (err) {
          log.error('Failed to fetch Git account status:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取账号状态失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60 * 5,
    })
  }

  /**
   * 获取 OAuth 授权 URL
   */
  function useOAuthUrlQuery(provider: 'github' | 'gitlab', redirectUri?: string) {
    return useQuery({
      queryKey: ['git-sync', 'oauth-url', provider, redirectUri],
      queryFn: async () => {
        try {
          const result = await trpc.gitSync.getOAuthUrl.query({ provider, redirectUri })
          return result.authUrl
        } catch (err) {
          log.error('Failed to get OAuth URL:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取授权链接失败', err.message)
          }
          throw err
        }
      },
      staleTime: 0,
      enabled: false, // 手动触发
    })
  }

  /**
   * 获取项目的同步日志
   */
  function useProjectSyncLogsQuery(
    projectId: string,
    limit = 20,
    status?: 'pending' | 'success' | 'failed',
  ) {
    return useQuery({
      queryKey: ['git-sync', 'logs', projectId, limit, status],
      queryFn: async () => {
        try {
          const result = await trpc.gitSync.getProjectSyncLogs.query({ projectId, limit, status })
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
          return result.syncs
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
   * 关联 Git 账号
   */
  const linkGitAccountMutation = useMutation({
    mutationFn: async ({
      provider,
      code,
      state,
    }: {
      provider: 'github' | 'gitlab'
      code: string
      state?: string
    }) => {
      return await trpc.gitSync.linkGitAccount.mutate({ provider, code, state })
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'account-status'] })
      toast.success(
        '关联成功',
        `已成功关联 ${variables.provider === 'github' ? 'GitHub' : 'GitLab'} 账号`,
      )
    },
    onError: (err) => {
      log.error('Failed to link Git account:', err)
      if (isTRPCClientError(err)) {
        toast.error('关联失败', err.message)
      }
    },
  })

  /**
   * 取消关联 Git 账号
   */
  const unlinkGitAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await trpc.gitSync.unlinkGitAccount.mutate({ accountId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'account-status'] })
      toast.success('取消关联成功', 'Git 账号已取消关联')
    },
    onError: (err) => {
      log.error('Failed to unlink Git account:', err)
      if (isTRPCClientError(err)) {
        toast.error('取消关联失败', err.message)
      }
    },
  })

  /**
   * 重试失败的同步任务
   */
  const retrySyncTaskMutation = useMutation({
    mutationFn: async (syncLogId: string) => {
      return await trpc.gitSync.retrySyncTask.mutate({ syncLogId })
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
   * 手动触发项目成员同步
   */
  const syncProjectMembersMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await trpc.gitSync.syncProjectMembers.mutate({ projectId })
    },
    onSuccess: (result, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['git-sync', 'logs', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'members', projectId] })
      toast.success('同步已触发', '正在同步项目成员权限...')
    },
    onError: (err) => {
      log.error('Failed to sync project members:', err)
      if (isTRPCClientError(err)) {
        toast.error('同步失败', err.message)
      }
    },
  })

  return {
    // Queries
    useGitAccountStatusQuery,
    useOAuthUrlQuery,
    useProjectSyncLogsQuery,
    useFailedSyncsQuery,

    // Mutations
    linkGitAccount: linkGitAccountMutation.mutateAsync,
    linkGitAccountMutation,
    unlinkGitAccount: unlinkGitAccountMutation.mutateAsync,
    unlinkGitAccountMutation,
    retrySyncTask: retrySyncTaskMutation.mutateAsync,
    retrySyncTaskMutation,
    syncProjectMembers: syncProjectMembersMutation.mutateAsync,
    syncProjectMembersMutation,
  }
}
