import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { inferRouterOutputs } from '@trpc/server'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type ProjectTeam = RouterOutput['projects']['listTeams'][number]

/**
 * 项目团队管理 (TanStack Query)
 */
export function useProjectTeams() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ==================== Queries ====================

  /**
   * 获取项目团队列表
   */
  function useTeamsQuery(projectId: string) {
    return useQuery({
      queryKey: ['projects', 'teams', projectId],
      queryFn: async () => {
        try {
          return await trpc.projects.listTeams.query({ projectId })
        } catch (err) {
          log.error('Failed to fetch teams:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取团队列表失败', err.message)
          }
          throw err
        }
      },
      staleTime: 1000 * 60 * 5,
      enabled: !!projectId,
    })
  }

  // ==================== Mutations ====================

  /**
   * 分配团队
   */
  const assignTeamMutation = useMutation({
    mutationFn: async ({ projectId, teamId }: { projectId: string; teamId: string }) => {
      return await trpc.projects.assignTeam.mutate({ projectId, teamId })
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'teams', variables.projectId] })
      toast.success('分配成功', '团队已分配到项目')
    },
    onError: (err) => {
      log.error('Failed to assign team:', err)
      if (isTRPCClientError(err)) {
        toast.error('分配团队失败', err.message)
      }
    },
  })

  /**
   * 移除团队
   */
  const removeTeamMutation = useMutation({
    mutationFn: async ({ projectId, teamId }: { projectId: string; teamId: string }) => {
      return await trpc.projects.removeTeam.mutate({ projectId, teamId })
    },
    onSuccess: (result, variables) => {
      // 乐观更新：从缓存中移除团队
      queryClient.setQueryData<ProjectTeam[]>(['projects', 'teams', variables.projectId], (old) =>
        old?.filter((t) => t.id !== variables.teamId),
      )
      toast.success('移除成功', '团队已移除')
    },
    onError: (err) => {
      log.error('Failed to remove team:', err)
      if (isTRPCClientError(err)) {
        toast.error('移除团队失败', err.message)
      }
    },
  })

  return {
    // Queries
    useTeamsQuery,

    // Mutations
    assignTeam: assignTeamMutation.mutateAsync,
    assignTeamMutation,
    removeTeam: removeTeamMutation.mutateAsync,
    removeTeamMutation,
  }
}
