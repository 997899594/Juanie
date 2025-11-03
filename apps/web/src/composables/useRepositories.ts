import { computed, type Ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useRepositories(projectId: Ref<string>) {
  const toast = useToast()

  const {
    data: repositories,
    isLoading,
    error,
    refetch,
  } = trpc.repositories.list.useQuery(
    computed(() => ({ projectId: projectId.value })),
    { enabled: computed(() => !!projectId.value) },
  )

  const connectMutation = trpc.repositories.connect.useMutation({
    onSuccess: () => {
      toast.success('仓库连接成功')
      refetch()
    },
    onError: (error) => {
      toast.error('连接失败', error.message)
    },
  })

  const syncMutation = trpc.repositories.sync.useMutation({
    onSuccess: () => {
      toast.success('仓库同步成功')
      refetch()
    },
    onError: (error) => {
      toast.error('同步失败', error.message)
    },
  })

  const disconnectMutation = trpc.repositories.disconnect.useMutation({
    onSuccess: () => {
      toast.success('仓库已断开')
      refetch()
    },
    onError: (error) => {
      toast.error('断开失败', error.message)
    },
  })

  return {
    repositories: computed(() => repositories.value || []),
    isLoading,
    error,
    refetch,
    connect: connectMutation.mutate,
    sync: syncMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isLoading,
    isSyncing: syncMutation.isLoading,
    isDisconnecting: disconnectMutation.isLoading,
  }
}
