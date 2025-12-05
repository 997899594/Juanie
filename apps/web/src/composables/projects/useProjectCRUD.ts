import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type RouterInput = inferRouterInputs<AppRouter>
type Project = RouterOutput['projects']['list'][number]
type ProjectDetail = RouterOutput['projects']['get']

/**
 * 项目 CRUD 操作 (TanStack Query)
 */
export function useProjectCRUD() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ==================== Queries ====================

  /**
   * 获取项目列表
   */
  function useProjectsQuery(organizationId: string) {
    return useQuery({
      queryKey: ['projects', 'list', organizationId],
      queryFn: async () => {
        try {
          return await trpc.projects.list.query({ organizationId })
        } catch (err) {
          log.error('Failed to fetch projects:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取项目列表失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60 * 5,
    })
  }

  /**
   * 获取单个项目详情
   */
  function useProjectQuery(projectId: string) {
    return useQuery({
      queryKey: ['projects', 'detail', projectId],
      queryFn: async () => {
        try {
          return await trpc.projects.get.query({ projectId })
        } catch (err) {
          log.error('Failed to fetch project:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取项目详情失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60 * 5,
      enabled: !!projectId,
    })
  }

  // ==================== Mutations ====================

  /**
   * 创建项目
   */
  const createProjectMutation = useMutation({
    mutationFn: async (
      data: RouterInput['projects']['create'] & {
        templateId?: string
        templateConfig?: Record<string, any>
        repository?:
          | {
              mode: 'existing'
              provider: 'github' | 'gitlab'
              url: string
              accessToken: string
              defaultBranch?: string
            }
          | {
              mode: 'create'
              provider: 'github' | 'gitlab'
              name: string
              visibility: 'public' | 'private'
              accessToken: string
              defaultBranch?: string
              includeAppCode?: boolean
            }
      },
    ) => {
      if (!data.name || !data.slug) {
        throw new Error('项目名称和标识不能为空')
      }

      if (data.repository) {
        if (data.repository.mode === 'existing' && !data.repository.url) {
          throw new Error('请输入仓库 URL')
        }
        if (data.repository.mode === 'create' && !data.repository.name) {
          throw new Error('请输入仓库名称')
        }
        if (!data.repository.accessToken) {
          throw new Error('请提供访问令牌或连接 OAuth 账户')
        }
      }

      return await trpc.projects.create.mutate(data)
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list', variables.organizationId] })

      if (variables.repository || variables.templateId) {
        toast.success('创建成功', '项目正在初始化，请稍候...')
      } else {
        toast.success('创建成功', `项目 "${variables.name}" 已创建`)
      }
    },
    onError: (err) => {
      log.error('Failed to create project:', err)
      const errorMessage = isTRPCClientError(err) ? err.message : '创建项目失败，请稍后重试'
      toast.error('创建项目失败', errorMessage)
    },
  })

  /**
   * 更新项目
   */
  const updateProjectMutation = useMutation({
    mutationFn: async ({ projectId, ...data }: RouterInput['projects']['update']) => {
      return await trpc.projects.update.mutate({ projectId, ...data })
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData(['projects', 'detail', variables.projectId], result)
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      toast.success('更新成功', '项目信息已更新')
    },
    onError: (err) => {
      log.error('Failed to update project:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新项目失败', err.message)
      }
    },
  })

  /**
   * 删除项目
   */
  const deleteProjectMutation = useMutation({
    mutationFn: async ({
      projectId,
      repositoryAction = 'keep',
    }: {
      projectId: string
      repositoryAction?: 'keep' | 'archive' | 'delete'
    }) => {
      return await trpc.projects.delete.mutate({ projectId, repositoryAction })
    },
    onSuccess: (result, variables) => {
      queryClient.removeQueries({ queryKey: ['projects', 'detail', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })

      const action = variables.repositoryAction || 'keep'
      if (action === 'keep') {
        toast.success('删除成功', '项目已删除')
      } else {
        toast.success(
          '删除成功',
          `项目已删除，正在${action === 'archive' ? '归档' : '删除'}仓库...`,
        )
      }
    },
    onError: (err) => {
      log.error('Failed to delete project:', err)
      if (isTRPCClientError(err)) {
        toast.error('删除项目失败', err.message)
      }
    },
  })

  /**
   * 归档项目
   */
  const archiveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await trpc.projects.archive.mutate({ projectId })
    },
    onSuccess: (result, projectId) => {
      queryClient.setQueryData<ProjectDetail>(['projects', 'detail', projectId], (old) =>
        old ? { ...old, status: 'archived' } : undefined,
      )
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      toast.success('归档成功', '项目已归档')
    },
    onError: (err) => {
      log.error('Failed to archive project:', err)
      if (isTRPCClientError(err)) {
        toast.error('归档项目失败', err.message)
      }
    },
  })

  /**
   * 恢复项目
   */
  const restoreProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await trpc.projects.restore.mutate({ projectId })
    },
    onSuccess: (result, projectId) => {
      queryClient.setQueryData<ProjectDetail>(['projects', 'detail', projectId], (old) =>
        old ? { ...old, status: 'active' } : undefined,
      )
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      toast.success('恢复成功', '项目已恢复')
    },
    onError: (err) => {
      log.error('Failed to restore project:', err)
      if (isTRPCClientError(err)) {
        toast.error('恢复项目失败', err.message)
      }
    },
  })

  return {
    // Queries
    useProjectsQuery,
    useProjectQuery,

    // Mutations
    createProject: createProjectMutation.mutateAsync,
    createProjectMutation,
    updateProject: updateProjectMutation.mutateAsync,
    updateProjectMutation,
    deleteProject: deleteProjectMutation.mutateAsync,
    deleteProjectMutation,
    archiveProject: archiveProjectMutation.mutateAsync,
    archiveProjectMutation,
    restoreProject: restoreProjectMutation.mutateAsync,
    restoreProjectMutation,
  }
}
