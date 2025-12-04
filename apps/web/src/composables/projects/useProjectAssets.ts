import { log } from '@juanie/ui'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { isTRPCClientError, trpc } from '@/lib/trpc'

/**
 * 项目资源管理（Logo 等）
 */
export function useProjectAssets() {
  const toast = useToast()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function uploadLogo(projectId: string, file: string, contentType: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.uploadLogo.mutate({
        projectId,
        file,
        contentType,
      })

      toast.success('上传成功', 'Logo 已更新')
      return result
    } catch (err) {
      log.error('Failed to upload logo:', err)
      error.value = '上传 Logo 失败'
      if (isTRPCClientError(err)) {
        toast.error('上传 Logo 失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteLogo(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.deleteLogo.mutate({ projectId })
      toast.success('删除成功', 'Logo 已删除')
      return result
    } catch (err) {
      log.error('Failed to delete logo:', err)
      error.value = '删除 Logo 失败'
      if (isTRPCClientError(err)) {
        toast.error('删除 Logo 失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    uploadLogo,
    deleteLogo,
  }
}
