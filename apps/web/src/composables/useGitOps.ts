import type {
  ConfigChange,
  ConfigChangePreview,
  DeploymentConfig,
  FluxHealth,
  FluxResourceKind,
  GitOpsResource,
  SyncResult,
  YAMLValidationResult,
} from '@juanie/types'
import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * GitOps 管理 Composable (TanStack Query)
 */
export function useGitOps() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ==================== Queries ====================

  /**
   * 获取项目的 GitOps 资源列表
   */
  function useGitOpsResourcesQuery(projectId: string) {
    return useQuery({
      queryKey: ['gitops', 'resources', projectId],
      queryFn: async () => {
        try {
          return await trpc.gitops.listGitOpsResources.query({ projectId })
        } catch (err) {
          log.error('Failed to fetch GitOps resources:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取 GitOps 资源失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 30, // 30 秒 - GitOps 资源状态变化较快
      enabled: !!projectId,
    })
  }

  /**
   * 获取单个 GitOps 资源详情
   */
  function useGitOpsResourceQuery(resourceId: string) {
    return useQuery({
      queryKey: ['gitops', 'resource', resourceId],
      queryFn: async () => {
        try {
          return await trpc.gitops.getGitOpsResource.query({ id: resourceId })
        } catch (err) {
          log.error('Failed to fetch GitOps resource:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取资源详情失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 30,
      enabled: !!resourceId,
    })
  }

  /**
   * 预览配置变更
   */
  function usePreviewChangesQuery(data: {
    projectId: string
    environmentId: string
    changes: ConfigChange[]
  }) {
    return useQuery({
      queryKey: ['gitops', 'preview', data.projectId, data.environmentId, data.changes],
      queryFn: async () => {
        try {
          return (await trpc.gitops.previewChanges.query(data)) as ConfigChangePreview
        } catch (err) {
          log.error('Failed to preview changes:', err)
          if (isTRPCClientError(err)) {
            toast.error('预览变更失败', err.message)
          }
          throw err
        }
      },
      staleTime: 0, // 不缓存预览结果
      enabled: false, // 手动触发
    })
  }

  /**
   * 验证 YAML 语法
   */
  function useValidateYAMLQuery(content: string) {
    return useQuery({
      queryKey: ['gitops', 'validate-yaml', content],
      queryFn: async () => {
        try {
          return (await trpc.gitops.validateYAML.query({ content })) as YAMLValidationResult
        } catch (err) {
          log.error('Failed to validate YAML:', err)
          if (isTRPCClientError(err)) {
            toast.error('验证 YAML 失败', err.message)
          }
          throw err
        }
      },
      staleTime: 0,
      enabled: false, // 手动触发
    })
  }

  // ==================== Mutations ====================

  /**
   * 创建 GitOps 资源
   */
  const createGitOpsResourceMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      environmentId: string
      repositoryId: string
      type: string
      name: string
      namespace: string
      config: Record<string, unknown>
    }) => {
      return await trpc.gitops.createGitOpsResource.mutate(data)
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resources', variables.projectId] })
      toast.success('GitOps 资源已创建', `${result.name} 创建成功`)
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
    mutationFn: async ({
      resourceId,
      ...data
    }: {
      resourceId: string
    } & Partial<Omit<GitOpsResource, 'id' | 'createdAt' | 'updatedAt'>>) => {
      return await trpc.gitops.updateGitOpsResource.mutate({ resourceId, ...data })
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitops', 'resource', variables.resourceId] })
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
    onSuccess: (result, resourceId) => {
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
    // Queries
    useGitOpsResourcesQuery,
    useGitOpsResourceQuery,
    usePreviewChangesQuery,
    useValidateYAMLQuery,

    // Mutations
    createGitOpsResource: createGitOpsResourceMutation.mutateAsync,
    createGitOpsResourceMutation,
    updateGitOpsResource: updateGitOpsResourceMutation.mutateAsync,
    updateGitOpsResourceMutation,
    deleteGitOpsResource: deleteGitOpsResourceMutation.mutateAsync,
    deleteGitOpsResourceMutation,
    triggerSync: triggerSyncMutation.mutateAsync,
    triggerSyncMutation,
    deployWithGitOps: deployWithGitOpsMutation.mutateAsync,
    deployWithGitOpsMutation,
    commitConfigChanges: commitConfigChangesMutation.mutateAsync,
    commitConfigChangesMutation,
  }
}
