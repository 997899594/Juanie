import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { inferRouterOutputs } from '@trpc/server'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type ProjectMember = RouterOutput['projects']['listMembers'][number]

/**
 * 项目成员管理 (TanStack Query)
 */
export function useProjectMembers() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ==================== Queries ====================

  /**
   * 获取项目成员列表
   */
  function useMembersQuery(projectId: string) {
    return useQuery({
      queryKey: ['projects', 'members', projectId],
      queryFn: async () => {
        try {
          return await trpc.projects.listMembers.query({ projectId })
        } catch (err) {
          log.error('Failed to fetch members:', err)
          if (isTRPCClientError(err)) {
            toast.error('获取成员列表失败', err.message)
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
   * 添加成员
   */
  const addMemberMutation = useMutation({
    mutationFn: async ({
      projectId,
      memberId,
      role,
    }: {
      projectId: string
      memberId: string
      role: 'admin' | 'developer' | 'viewer'
    }) => {
      return await trpc.projects.addMember.mutate({ projectId, memberId, role })
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'members', variables.projectId] })
      toast.success('添加成功', '成员已添加到项目')
    },
    onError: (err) => {
      log.error('Failed to add member:', err)
      if (isTRPCClientError(err)) {
        toast.error('添加成员失败', err.message)
      }
    },
  })

  /**
   * 更新成员角色
   */
  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({
      projectId,
      memberId,
      role,
    }: {
      projectId: string
      memberId: string
      role: 'admin' | 'developer' | 'viewer'
    }) => {
      return await trpc.projects.updateMemberRole.mutate({ projectId, memberId, role })
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'members', variables.projectId] })
      toast.success('更新成功', '成员角色已更新')
    },
    onError: (err) => {
      log.error('Failed to update member role:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新成员角色失败', err.message)
      }
    },
  })

  /**
   * 移除成员
   */
  const removeMemberMutation = useMutation({
    mutationFn: async ({ projectId, memberId }: { projectId: string; memberId: string }) => {
      return await trpc.projects.removeMember.mutate({ projectId, memberId })
    },
    onSuccess: (result, variables) => {
      // 乐观更新：从缓存中移除成员
      queryClient.setQueryData<ProjectMember[]>(
        ['projects', 'members', variables.projectId],
        (old) => old?.filter((m) => m.id !== variables.memberId),
      )
      toast.success('移除成功', '成员已移除')
    },
    onError: (err) => {
      log.error('Failed to remove member:', err)
      if (isTRPCClientError(err)) {
        toast.error('移除成员失败', err.message)
      }
    },
  })

  return {
    // Queries
    useMembersQuery,

    // Mutations
    addMember: addMemberMutation.mutateAsync,
    addMemberMutation,
    updateMemberRole: updateMemberRoleMutation.mutateAsync,
    updateMemberRoleMutation,
    removeMember: removeMemberMutation.mutateAsync,
    removeMemberMutation,
  }
}
