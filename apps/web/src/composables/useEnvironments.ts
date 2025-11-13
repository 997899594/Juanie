import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * 环境管理组合式函数
 * 提供环境的 CRUD 操作
 */
export function useEnvironments() {
  const toast = useToast()

  const environments = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

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

  /**
   * 创建环境
   */
  const create = async (input: any) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.environments.create.mutate(input)
      toast.success('环境创建成功')
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('创建失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 更新环境
   */
  const update = async (input: any) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.environments.update.mutate(input)
      toast.success('环境更新成功')
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('更新失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 删除环境
   */
  const remove = async (payload: { environmentId: string }) => {
    isLoading.value = true
    error.value = null
    try {
      await trpc.environments.delete.mutate(payload)
      toast.success('环境删除成功')
    } catch (e) {
      error.value = e as Error
      toast.error('删除失败', (e as Error)?.message || '未知错误')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    environments: computed(() => environments.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchEnvironments,
    create,
    update,
    delete: remove,
  }
}
