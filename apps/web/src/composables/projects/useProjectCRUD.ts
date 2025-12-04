import { log } from '@juanie/ui'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type RouterInput = inferRouterInputs<AppRouter>
type Project = RouterOutput['projects']['list'][number]
type ProjectDetail = RouterOutput['projects']['get']

/**
 * 项目 CRUD 操作
 */
export function useProjectCRUD() {
  const toast = useToast()
  const projects = ref<Project[]>([])
  const currentProject = ref<ProjectDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasProjects = computed(() => projects.value.length > 0)
  const currentProjectId = computed(() => currentProject.value?.id)

  async function fetchProjects(organizationId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.list.query({ organizationId })
      projects.value = result
      return result
    } catch (err) {
      log.error('Failed to fetch projects:', err)
      error.value = '获取项目列表失败'
      if (isTRPCClientError(err)) {
        toast.error('获取项目列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.get.query({ projectId })
      currentProject.value = result
      return result
    } catch (err) {
      log.error('Failed to fetch project:', err)
      error.value = '获取项目详情失败'
      if (isTRPCClientError(err)) {
        toast.error('获取项目详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createProject(
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
  ): Promise<{ project: Project; jobIds?: string[] }> {
    loading.value = true
    error.value = null

    try {
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

      const result = await trpc.projects.create.mutate(data)
      await fetchProjects(data.organizationId)

      if (data.repository || data.templateId) {
        toast.success('创建成功', '项目正在初始化，请稍候...')
      } else {
        toast.success('创建成功', `项目 "${data.name}" 已创建`)
      }

      return { project: result, jobIds: [] }
    } catch (err) {
      log.error('Failed to create project:', err)
      const errorMessage = isTRPCClientError(err) ? err.message : '创建项目失败，请稍后重试'
      error.value = errorMessage
      toast.error('创建项目失败', errorMessage)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateProject(
    projectId: string,
    data: Omit<RouterInput['projects']['update'], 'projectId'>,
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.update.mutate({ projectId, ...data })

      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, ...result }
      }

      const projectIndex = projects.value.findIndex((p) => p.id === projectId)
      if (projectIndex !== -1 && projects.value[projectIndex]) {
        projects.value[projectIndex] = { ...projects.value[projectIndex], ...result }
      }

      toast.success('更新成功', '项目信息已更新')
      return result
    } catch (err) {
      log.error('Failed to update project:', err)
      error.value = '更新项目失败'
      if (isTRPCClientError(err)) {
        toast.error('更新项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(
    projectId: string,
    options?: { repositoryAction?: 'keep' | 'archive' | 'delete' },
  ): Promise<string[]> {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.delete.mutate({
        projectId,
        repositoryAction: options?.repositoryAction || 'keep',
      })

      projects.value = projects.value.filter((p) => p.id !== projectId)

      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }

      const action = options?.repositoryAction || 'keep'
      if (action === 'keep') {
        toast.success('删除成功', '项目已删除')
      } else {
        toast.success(
          '删除成功',
          `项目已删除，正在${action === 'archive' ? '归档' : '删除'}仓库...`,
        )
      }

      return result.jobIds || []
    } catch (err) {
      log.error('Failed to delete project:', err)
      error.value = '删除项目失败'
      if (isTRPCClientError(err)) {
        toast.error('删除项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function archiveProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.archive.mutate({ projectId })

      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, status: 'archived' }
      }

      toast.success('归档成功', '项目已归档')
      return result
    } catch (err) {
      log.error('Failed to archive project:', err)
      error.value = '归档项目失败'
      if (isTRPCClientError(err)) {
        toast.error('归档项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function restoreProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.restore.mutate({ projectId })

      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, status: 'active' }
      }

      toast.success('恢复成功', '项目已恢复')
      return result
    } catch (err) {
      log.error('Failed to restore project:', err)
      error.value = '恢复项目失败'
      if (isTRPCClientError(err)) {
        toast.error('恢复项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    projects,
    currentProject,
    loading,
    error,
    hasProjects,
    currentProjectId,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    restoreProject,
  }
}
