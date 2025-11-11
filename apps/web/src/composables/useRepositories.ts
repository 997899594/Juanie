import { computed, type Ref, ref, watch } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useRepositories(projectId: Ref<string>) {
  const toast = useToast()

  const repositories = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const fetchRepositories = async () => {
    if (!projectId.value) return
    isLoading.value = true
    try {
      const result = await trpc.repositories.list.query({ projectId: projectId.value })
      repositories.value = result ?? []
      error.value = null
    } catch (e) {
      error.value = e as Error
      toast.error('获取仓库列表失败', (e as Error)?.message || '未知错误')
    } finally {
      isLoading.value = false
    }
  }

  watch(
    projectId,
    (id) => {
      if (id) fetchRepositories()
    },
    { immediate: true },
  )

  const isConnecting = ref(false)
  const connect = async (payload: {
    projectId: string
    provider: 'github' | 'gitlab'
    fullName: string
    cloneUrl: string
    defaultBranch?: string
  }) => {
    isConnecting.value = true
    try {
      await trpc.repositories.connect.mutate(payload)
      toast.success('仓库连接成功')
      await fetchRepositories()
    } catch (e) {
      toast.error('连接失败', (e as Error)?.message || '未知错误')
    } finally {
      isConnecting.value = false
    }
  }

  const isSyncing = ref(false)
  const sync = async (payload: { repositoryId: string }) => {
    isSyncing.value = true
    try {
      await trpc.repositories.sync.mutate(payload)
      toast.success('仓库同步成功')
      await fetchRepositories()
    } catch (e) {
      toast.error('同步失败', (e as Error)?.message || '未知错误')
    } finally {
      isSyncing.value = false
    }
  }

  const isDisconnecting = ref(false)
  const disconnect = async (payload: { repositoryId: string }) => {
    isDisconnecting.value = true
    try {
      await trpc.repositories.disconnect.mutate(payload)
      toast.success('仓库已断开')
      await fetchRepositories()
    } catch (e) {
      toast.error('断开失败', (e as Error)?.message || '未知错误')
    } finally {
      isDisconnecting.value = false
    }
  }

  return {
    repositories: computed(() => repositories.value || []),
    isLoading,
    error,
    refetch: fetchRepositories,
    connect,
    sync,
    disconnect,
    isConnecting,
    isSyncing,
    isDisconnecting,
  }
}
