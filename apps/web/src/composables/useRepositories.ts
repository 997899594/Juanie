import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * 仓库管理组合式函数
 * 提供仓库的查看和 GitOps 配置操作
 */
export function useRepositories() {
  const toast = useToast()

  const repositories = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * 获取项目的仓库列表
   */
  const fetchRepositories = async (projectId: string) => {
    if (!projectId) return

    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.repositories.list.query({ projectId })
      repositories.value = result ?? []
    } catch (e) {
      error.value = e as Error
      toast.error('获取仓库列表失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 启用仓库的 GitOps
   */
  const enableGitOps = async (payload: {
    repositoryId: string
    config?: {
      fluxNamespace?: string
      fluxResourceName?: string
      syncInterval?: string
      secretRef?: string
      timeout?: string
    }
  }) => {
    isLoading.value = true
    error.value = null
    try {
      // 确保 config 不为 undefined
      const apiPayload = {
        repositoryId: payload.repositoryId,
        config: payload.config || {},
      }
      const result = await trpc.repositories.enableGitOps.mutate(apiPayload)
      toast.success('GitOps 已启用')
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('启用 GitOps 失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 禁用仓库的 GitOps
   */
  const disableGitOps = async (payload: { repositoryId: string }) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.repositories.disableGitOps.mutate(payload)
      toast.success('GitOps 已禁用')
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('禁用 GitOps 失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取仓库的 Flux 同步状态
   */
  const getFluxStatus = async (payload: { repositoryId: string }) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.repositories.getFluxStatus.query(payload)
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('获取 Flux 状态失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    repositories: computed(() => repositories.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchRepositories,
    enableGitOps,
    disableGitOps,
    getFluxStatus,
  }
}
