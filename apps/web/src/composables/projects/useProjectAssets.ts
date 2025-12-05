import { log } from '@juanie/ui'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@/composables/useToast'
import { isTRPCClientError, trpc } from '@/lib/trpc'

/**
 * 项目资源管理 (TanStack Query)
 */
export function useProjectAssets() {
  const toast = useToast()
  const queryClient = useQueryClient()

  /**
   * 上传 Logo
   */
  const uploadLogoMutation = useMutation({
    mutationFn: async ({
      projectId,
      file,
      contentType,
    }: {
      projectId: string
      file: string
      contentType: string
    }) => {
      return await trpc.projects.uploadLogo.mutate({ projectId, file, contentType })
    },
    onSuccess: (result, variables) => {
      // 使项目详情缓存失效，以获取新的 Logo URL
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      toast.success('上传成功', 'Logo 已更新')
    },
    onError: (err) => {
      log.error('Failed to upload logo:', err)
      if (isTRPCClientError(err)) {
        toast.error('上传 Logo 失败', err.message)
      }
    },
  })

  /**
   * 删除 Logo
   */
  const deleteLogoMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await trpc.projects.deleteLogo.mutate({ projectId })
    },
    onSuccess: (result, projectId) => {
      // 使项目详情缓存失效
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      toast.success('删除成功', 'Logo 已删除')
    },
    onError: (err) => {
      log.error('Failed to delete logo:', err)
      if (isTRPCClientError(err)) {
        toast.error('删除 Logo 失败', err.message)
      }
    },
  })

  return {
    // Mutations
    uploadLogo: uploadLogoMutation.mutateAsync,
    uploadLogoMutation,
    deleteLogo: deleteLogoMutation.mutateAsync,
    deleteLogoMutation,
  }
}
