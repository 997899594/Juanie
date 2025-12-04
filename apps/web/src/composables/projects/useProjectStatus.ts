import { log } from '@juanie/ui'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { isTRPCClientError, trpc } from '@/lib/trpc'

/**
 * 项目状态和健康度管理
 */
export function useProjectStatus() {
  const toast = useToast()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getStatus(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.getStatus.query({ projectId })
      return result
    } catch (err) {
      log.error('Failed to get project status:', err)
      error.value = '获取项目状态失败'
      if (isTRPCClientError(err)) {
        toast.error('获取项目状态失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getHealth(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.getHealth.query({ projectId })
      return result
    } catch (err) {
      log.error('Failed to get project health:', err)
      error.value = '获取项目健康度失败'
      if (isTRPCClientError(err)) {
        toast.error('获取项目健康度失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getStatus,
    getHealth,
  }
}
