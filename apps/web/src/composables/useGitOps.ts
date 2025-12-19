import type { ConfigChange, DeploymentConfig, FluxResourceKind } from '@juanie/types'
import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { computed, unref } from 'vue'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * GitOps 管理 Composable (TanStack Query)
 */
export function useGitOps(projectId?: MaybeRef<string>) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const pid = computed(() => (projectId ? unref(projectId) : ''))

  // ==================== Queries ====================

  /**
   * 获取项目的 GitOps 资源列表
   */
  const {
    data: resources,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['gitops', 'resources', pid],
    queryFn: async () => {
      if (!pid.value) return []
      try {
        return await trpc.gitops.listGitOpsResources.query({ projectId: pid.value })
      } catch (err) {
        log.error('Failed to fetch GitOps resources:', err)
        if (isTRPCClientError(err)) {
          toast.error('获取 GitOps 资源失败', err.message)
        }
        throw err
      }
    },
    staleTime: 1000 * 30, // 30 秒 - GitOps 资源状态变化较快
    enabled: computed(() => !!pid.value),
  })

  // ==================== Mutations ====================

  /**
   * 创建 GitOps 资源
   */
  const createGitOpsResourceMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      environmentId: string
      repositoryId: string
      type: 'kustomization' | 'helm'
      name: string
      namespace: string
      config: any
    }) => {
      return await trpc.gitops.createGitOpsResource.mutate(data)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources', variables.projectId] })
      toast.success('GitOps 资源已创建')
    },
    onError: (err) => {
      log.error('Failed to create GitOps resource:', err)
      if (isTRPCClientError(err)) {
        toast.error('创建 GitOps 资源失败', err.message)
      }
    },
  })

  /**
   * 更新 GitOps 资源
   */
  const updateGitOpsResourceMutation = useMutation({
    mutationFn: async (data: {
      id: string
      config?: any
      status?: string
      errorMessage?: string
    }) => {
      return await trpc.gitops.updateGitOpsResource.mutate(data)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resource', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources'] })
      toast.success('GitOps 资源已更新')
    },
    onError: (err) => {
      log.error('Failed to update GitOps resource:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新 GitOps 资源失败', err.message)
      }
    },
  })

  /**
   * 删除 GitOps 资源
   */
  const deleteGitOpsResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      return await trpc.gitops.deleteGitOpsResource.mutate({ id: resourceId })
    },
    onSuccess: (_result, resourceId) => {
      queryClient.removeQueries({ queryKey: ['gitops', 'resource', resourceId] })
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources'] })
      toast.success('GitOps 资源已删除')
    },
    onError: (err) => {
      log.error('Failed to delete GitOps resource:', err)
      if (isTRPCClientError(err)) {
        toast.error('删除 GitOps 资源失败', err.message)
      }
    },
  })

  /**
   * 手动触发同步
   */
  const triggerSyncMutation = useMutation({
    mutationFn: async (data: { kind: FluxResourceKind; name: string; namespace: string }) => {
      return await trpc.gitops.triggerSync.mutate(data)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources'] })
      toast.success('同步已触发', result.message)
    },
    onError: (err) => {
      log.error('Failed to trigger sync:', err)
      if (isTRPCClientError(err)) {
        toast.error('触发同步失败', err.message)
      }
    },
  })

  /**
   * 通过 GitOps 部署
   */
  const deployWithGitOpsMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      environmentId: string
      changes: DeploymentConfig
      commitMessage?: string
    }) => {
      const payload = {
        projectId: data.projectId,
        environmentId: data.environmentId,
        config: {
          image: data.changes.image,
          replicas: data.changes.replicas,
          resources: data.changes.resources,
        },
        commitMessage: data.commitMessage,
      }
      return await trpc.gitops.deployWithGitOps.mutate(payload)
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources', variables.projectId] })
      toast.success('部署已提交', result.message)
    },
    onError: (err) => {
      log.error('Failed to deploy with GitOps:', err)
      if (isTRPCClientError(err)) {
        toast.error('GitOps 部署失败', err.message)
      }
    },
  })

  /**
   * 提交配置变更到 Git
   */
  const commitConfigChangesMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      environmentId: string
      changes: ConfigChange[]
      commitMessage?: string
    }) => {
      return await trpc.gitops.commitConfigChanges.mutate(data)
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources', variables.projectId] })
      toast.success('配置已提交', result.message)
    },
    onError: (err) => {
      log.error('Failed to commit config changes:', err)
      if (isTRPCClientError(err)) {
        toast.error('提交配置失败', err.message)
      }
    },
  })

  return {
    // Query 数据
    resources,
    isLoading,
    error,

    // Mutations
    createGitOpsResource: createGitOpsResourceMutation.mutateAsync,
    updateGitOpsResource: updateGitOpsResourceMutation.mutateAsync,
    deleteGitOpsResource: deleteGitOpsResourceMutation.mutateAsync,
    triggerSync: triggerSyncMutation.mutateAsync,
    deployWithGitOps: deployWithGitOpsMutation.mutateAsync,
    commitConfigChanges: commitConfigChangesMutation.mutateAsync,
  }
}
