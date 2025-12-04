import { log } from '@juanie/ui'
import type { inferRouterOutputs } from '@trpc/server'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type ProjectTeam = RouterOutput['projects']['listTeams'][number]

/**
 * 项目团队管理
 */
export function useProjectTeams() {
  const toast = useToast()
  const teams = ref<ProjectTeam[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTeams(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.listTeams.query({ projectId })
      teams.value = result
      return result
    } catch (err) {
      log.error('Failed to fetch teams:', err)
      error.value = '获取团队列表失败'
      if (isTRPCClientError(err)) {
        toast.error('获取团队列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function assignTeam(projectId: string, teamId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.assignTeam.mutate({ projectId, teamId })
      await fetchTeams(projectId)
      toast.success('分配成功', '团队已分配到项目')
      return result
    } catch (err) {
      log.error('Failed to assign team:', err)
      error.value = '分配团队失败'
      if (isTRPCClientError(err)) {
        toast.error('分配团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function removeTeam(projectId: string, teamId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.removeTeam.mutate({ projectId, teamId })
      teams.value = teams.value.filter((t) => t.id !== teamId)
      toast.success('移除成功', '团队已移除')
    } catch (err) {
      log.error('Failed to remove team:', err)
      error.value = '移除团队失败'
      if (isTRPCClientError(err)) {
        toast.error('移除团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    teams,
    loading,
    error,
    fetchTeams,
    assignTeam,
    removeTeam,
  }
}
