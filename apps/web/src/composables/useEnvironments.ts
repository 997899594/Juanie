import { computed, type Ref, ref, watch } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useEnvironments(projectId: Ref<string>) {
  const toast = useToast()

  const environments = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const fetchEnvironments = async () => {
    if (!projectId.value) return
    isLoading.value = true
    try {
      const result = await trpc.environments.list.query({ projectId: projectId.value })
      environments.value = Array.isArray(result) ? result : []
      error.value = null
    } catch (e) {
      error.value = e as Error
      toast.error('获取环境列表失败', (e as Error)?.message || '未知错误')
    } finally {
      isLoading.value = false
    }
  }

  watch(
    projectId,
    (id) => {
      if (id) fetchEnvironments()
    },
    { immediate: true },
  )

  const isCreating = ref(false)
  const create = async (input: any) => {
    isCreating.value = true
    try {
      await trpc.environments.create.mutate(input)
      toast.success('环境创建成功')
      await fetchEnvironments()
    } catch (e) {
      toast.error('创建失败', (e as Error)?.message || '未知错误')
    } finally {
      isCreating.value = false
    }
  }

  const isUpdating = ref(false)
  const update = async (input: any) => {
    isUpdating.value = true
    try {
      await trpc.environments.update.mutate(input)
      toast.success('环境更新成功')
      await fetchEnvironments()
    } catch (e) {
      toast.error('更新失败', (e as Error)?.message || '未知错误')
    } finally {
      isUpdating.value = false
    }
  }

  const isDeleting = ref(false)
  const remove = async (payload: { environmentId: string }) => {
    isDeleting.value = true
    try {
      await trpc.environments.delete.mutate(payload)
      toast.success('环境删除成功')
      await fetchEnvironments()
    } catch (e) {
      toast.error('删除失败', (e as Error)?.message || '未知错误')
    } finally {
      isDeleting.value = false
    }
  }

  return {
    environments: computed(() => environments.value || []),
    isLoading,
    error,
    refetch: fetchEnvironments,
    create,
    update,
    delete: remove,
    isCreating,
    isUpdating,
    isDeleting,
  }
}
