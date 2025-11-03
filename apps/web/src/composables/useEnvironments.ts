import { computed, type Ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useEnvironments(projectId: Ref<string>) {
  const toast = useToast()

  const {
    data: environments,
    isLoading,
    error,
    refetch,
  } = trpc.environments.list.useQuery(
    computed(() => ({ projectId: projectId.value })),
    { enabled: computed(() => !!projectId.value) },
  )

  const createMutation = trpc.environments.create.useMutation({
    onSuccess: () => {
      toast.success('环境创建成功')
      refetch()
    },
    onError: (error) => {
      toast.error('创建失败', error.message)
    },
  })

  const updateMutation = trpc.environments.update.useMutation({
    onSuccess: () => {
      toast.success('环境更新成功')
      refetch()
    },
    onError: (error) => {
      toast.error('更新失败', error.message)
    },
  })

  const deleteMutation = trpc.environments.delete.useMutation({
    onSuccess: () => {
      toast.success('环境删除成功')
      refetch()
    },
    onError: (error) => {
      toast.error('删除失败', error.message)
    },
  })

  return {
    environments: computed(() => environments.value || []),
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
