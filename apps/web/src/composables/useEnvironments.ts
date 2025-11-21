import { computed, isRef, onMounted, ref, watch } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * 环境管理组合式函数
 * 提供环境的 CRUD 操作
 */
export function useEnvironments(projectId?: string | ReturnType<typeof ref<string>>) {
  const toast = useToast()

  const environments = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const currentProjectId = ref<string>('')

  /**
   * 获取项目的环境列表
   */
  const fetchEnvironments = async (projectId: string) => {
    if (!projectId) return

    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.environments.list.query({ projectId })
      environments.value = Array.isArray(result) ? result : []
    } catch (e) {
      error.value = e as Error
      toast.error('获取环境列表失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const initWatcher = () => {
    if (!projectId) return
    if (isRef(projectId)) {
      watch(
        projectId,
        (val) => {
          currentProjectId.value = val || ''
          if (currentProjectId.value) fetchEnvironments(currentProjectId.value)
        },
        { immediate: true },
      )
    } else {
      currentProjectId.value = projectId
      if (currentProjectId.value) fetchEnvironments(currentProjectId.value)
    }
  }
  onMounted(() => initWatcher())

  /**
   * 创建环境
   */
  const create = async (input: any) => {
    isCreating.value = true
    error.value = null
    try {
      const result = await trpc.environments.create.mutate(input)
      toast.success('环境创建成功')
      if (currentProjectId.value) await fetchEnvironments(currentProjectId.value)
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('创建失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isCreating.value = false
    }
  }

  /**
   * 更新环境
   */
  const update = async (input: any) => {
    isUpdating.value = true
    error.value = null
    try {
      const result = await trpc.environments.update.mutate(input)
      toast.success('环境更新成功')
      if (currentProjectId.value) await fetchEnvironments(currentProjectId.value)
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('更新失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * 删除环境
   */
  const remove = async (payload: { environmentId: string }) => {
    isDeleting.value = true
    error.value = null
    try {
      await trpc.environments.delete.mutate(payload)
      toast.success('环境删除成功')
      if (currentProjectId.value) await fetchEnvironments(currentProjectId.value)
    } catch (e) {
      error.value = e as Error
      toast.error('删除失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isDeleting.value = false
    }
  }

  /**
   * 配置环境的 GitOps
   */
  const configureGitOps = async (payload: {
    environmentId: string
    config: {
      repositoryId: string
      branch: string
      path: string
      autoSync?: boolean
      syncInterval?: string
    }
  }) => {
    isUpdating.value = true
    error.value = null
    try {
      // 映射字段名到 API 期望的格式
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
      const result = await trpc.environments.configureGitOps.mutate(apiPayload)
      toast.success('GitOps 配置成功')
      if (currentProjectId.value) await fetchEnvironments(currentProjectId.value)
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('配置 GitOps 失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * 获取环境的 GitOps 配置
   */
  const getGitOpsConfig = async (payload: { environmentId: string }) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.environments.getGitOpsConfig.query(payload)
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('获取 GitOps 配置失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 禁用环境的 GitOps
   */
  const disableGitOps = async (payload: { environmentId: string }) => {
    isUpdating.value = true
    error.value = null
    try {
      const result = await trpc.environments.disableGitOps.mutate(payload)
      toast.success('GitOps 已禁用')
      if (currentProjectId.value) await fetchEnvironments(currentProjectId.value)
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('禁用 GitOps 失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isUpdating.value = false
    }
  }

  return {
    environments: computed(() => environments.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    isCreating: computed(() => isCreating.value),
    isUpdating: computed(() => isUpdating.value),
    isDeleting: computed(() => isDeleting.value),
    fetchEnvironments,
    create,
    update,
    delete: remove,
    configureGitOps,
    getGitOpsConfig,
    disableGitOps,
  }
}
