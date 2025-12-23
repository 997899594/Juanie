import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { computed, unref } from 'vue'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * 环境管理组合式函数 (TanStack Query)
 */
export function useEnvironments(projectId: MaybeRef<string>) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const pid = computed(() => unref(projectId))

  // ==================== Queries ====================

  /**
   * 获取项目的环境列表
   */
  const {
    data: environments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['environments', 'list', pid],
    queryFn: async () => {
      if (!pid.value) return []
      try {
        const result = await trpc.environments.list.query({ projectId: pid.value })
        return Array.isArray(result) ? result : []
      } catch (err) {
        log.error('Failed to fetch environments:', err)
        if (isTRPCClientError(err)) {
          toast.error('获取环境列表失败', err.message)
        }
        throw err
      }
    },
    staleTime: 1000 * 60 * 5,
    enabled: computed(() => !!pid.value),
  })

  // ==================== Mutations ====================

  /**
   * 创建环境
   */
  const createEnvironmentMutation = useMutation({
    mutationFn: async (input: any) => {
      return await trpc.environments.create.mutate(input)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['environments', 'list', variables.projectId] })
      toast.success('环境创建成功')
    },
    onError: (err) => {
      log.error('Failed to create environment:', err)
      if (isTRPCClientError(err)) {
        toast.error('创建失败', err.message)
      }
    },
  })

  /**
   * 更新环境
   */
  const updateEnvironmentMutation = useMutation({
    mutationFn: async (input: any) => {
      return await trpc.environments.update.mutate(input)
    },
    onSuccess: (_result, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['environments', 'list'] })
      toast.success('环境更新成功')
    },
    onError: (err) => {
      log.error('Failed to update environment:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新失败', err.message)
      }
    },
  })

  /**
   * 删除环境
   */
  const deleteEnvironmentMutation = useMutation({
    mutationFn: async (payload: { environmentId: string }) => {
      return await trpc.environments.delete.mutate(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', 'list'] })
      toast.success('环境删除成功')
    },
    onError: (err) => {
      log.error('Failed to delete environment:', err)
      if (isTRPCClientError(err)) {
        toast.error('删除失败', err.message)
      }
    },
  })

  /**
   * 配置环境的 GitOps
   */
  const configureGitOpsMutation = useMutation({
    mutationFn: async (payload: {
      environmentId: string
      config: {
        repositoryId: string
        branch: string
        path: string
        autoSync?: boolean
        syncInterval?: string
      }
    }) => {
      const apiPayload = {
        environmentId: payload.environmentId,
        config: {
          enabled: true,
          gitBranch: payload.config.branch,
          gitPath: payload.config.path,
          autoSync: payload.config.autoSync,
          syncInterval: payload.config.syncInterval,
        },
      }
      return await trpc.environments.configureGitOps.mutate(apiPayload)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['environments', 'list'] })
      queryClient.invalidateQueries({
        queryKey: ['environments', 'gitops-config', variables.environmentId],
      })
      toast.success('GitOps 配置成功')
    },
    onError: (err) => {
      log.error('Failed to configure GitOps:', err)
      if (isTRPCClientError(err)) {
        toast.error('配置 GitOps 失败', err.message)
      }
    },
  })

  /**
   * 禁用环境的 GitOps
   */
  const disableGitOpsMutation = useMutation({
    mutationFn: async (payload: { environmentId: string }) => {
      return await trpc.environments.disableGitOps.mutate(payload)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['environments', 'list'] })
      queryClient.invalidateQueries({
        queryKey: ['environments', 'gitops-config', variables.environmentId],
      })
      toast.success('GitOps 已禁用')
    },
    onError: (err) => {
      log.error('Failed to disable GitOps:', err)
      if (isTRPCClientError(err)) {
        toast.error('禁用 GitOps 失败', err.message)
      }
    },
  })

  return {
    // Query 数据
    environments,
    isLoading,
    error,

    // Mutations
    create: createEnvironmentMutation.mutateAsync,
    isCreating: createEnvironmentMutation.isPending,
    update: updateEnvironmentMutation.mutateAsync,
    isUpdating: updateEnvironmentMutation.isPending,
    delete: deleteEnvironmentMutation.mutateAsync,
    isDeleting: deleteEnvironmentMutation.isPending,
    configureGitOps: configureGitOpsMutation.mutateAsync,
    disableGitOps: disableGitOpsMutation.mutateAsync,
  }
}
