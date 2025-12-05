import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { inferRouterOutputs } from '@trpc/server'
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type Team = RouterOutput['teams']['list'][number]
type TeamMember = RouterOutput['teams']['listMembers'][number]

/**
 * 团队管理组合式函数
 * 提供团队的 CRUD 操作和成员管理
 */
export function useTeams(organizationId?: string, teamId?: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  // 查询：团队列表
  const {
    data: teams,
    isLoading: isLoadingList,
    error: listError,
  } = useQuery({
    queryKey: ['teams', 'list', organizationId],
    queryFn: () => trpc.teams.list.query({ organizationId: organizationId! }),
    enabled: !!organizationId,
  })

  // 查询：团队详情
  const {
    data: currentTeam,
    isLoading: isLoadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ['teams', 'detail', teamId],
    queryFn: () => trpc.teams.get.query({ teamId: teamId! }),
    enabled: !!teamId,
  })

  // 查询：团队成员
  const {
    data: members,
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ['teams', 'members', teamId],
    queryFn: () => trpc.teams.listMembers.query({ teamId: teamId! }),
    enabled: !!teamId,
  })

  // 计算属性
  const hasTeams = computed(() => (teams.value?.length ?? 0) > 0)
  const currentTeamId = computed(() => currentTeam.value?.id)
  const loading = computed(
    () => isLoadingList.value || isLoadingDetail.value || isLoadingMembers.value,
  )
  const error = computed(() => listError.value || detailError.value || membersError.value)

  // Mutation：创建团队
  const createMutation = useMutation({
    mutationFn: (data: {
      organizationId: string
      name: string
      slug?: string
      description?: string
    }) => {
      const slug =
        data.slug ||
        data.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      return trpc.teams.create.mutate({ ...data, slug })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'list', variables.organizationId] })
      toast.success('创建成功', `团队 "${variables.name}" 已创建`)
    },
    onError: (err) => {
      log.error('Failed to create team:', err)
      if (isTRPCClientError(err)) {
        toast.error('创建团队失败', err.message)
      }
    },
  })

  // Mutation：更新团队
  const updateMutation = useMutation({
    mutationFn: (data: { teamId: string; name?: string; description?: string }) =>
      trpc.teams.update.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'detail', variables.teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', 'list'] })
      toast.success('更新成功', '团队信息已更新')
    },
    onError: (err) => {
      log.error('Failed to update team:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新团队失败', err.message)
      }
    },
  })

  // Mutation：删除团队
  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => trpc.teams.delete.mutate({ teamId }),
    onMutate: async (teamId) => {
      await queryClient.cancelQueries({ queryKey: ['teams', 'list'] })
      const previousTeams = queryClient.getQueryData<Team[]>(['teams', 'list', organizationId])
      queryClient.setQueryData<Team[]>(['teams', 'list', organizationId], (old) =>
        old?.filter((team) => team.id !== teamId),
      )
      return { previousTeams }
    },
    onSuccess: () => {
      toast.success('删除成功', '团队已删除')
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['teams', 'list', organizationId], context?.previousTeams)
      log.error('Failed to delete team:', err)
      if (isTRPCClientError(err)) {
        toast.error('删除团队失败', err.message)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'list'] })
    },
  })

  // Mutation：添加成员
  const addMemberMutation = useMutation({
    mutationFn: (data: { teamId: string; userId: string; role: 'lead' | 'member' }) => {
      const apiRole = data.role === 'lead' ? 'maintainer' : 'member'
      return trpc.teams.addMember.mutate({
        teamId: data.teamId,
        userId: data.userId,
        role: apiRole as 'member' | 'owner' | 'maintainer',
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] })
      toast.success('添加成功', '成员已添加到团队')
    },
    onError: (err) => {
      log.error('Failed to add member:', err)
      if (isTRPCClientError(err)) {
        toast.error('添加成员失败', err.message)
      }
    },
  })

  // Mutation：更新成员角色
  const updateMemberRoleMutation = useMutation({
    mutationFn: (data: { teamId: string; memberId: string; role: 'lead' | 'member' }) => {
      const apiRole = data.role === 'lead' ? 'maintainer' : 'member'
      return trpc.teams.updateMemberRole.mutate({
        teamId: data.teamId,
        memberId: data.memberId,
        role: apiRole as 'member' | 'owner' | 'maintainer',
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] })
      toast.success('更新成功', '成员角色已更新')
    },
    onError: (err) => {
      log.error('Failed to update member role:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新成员角色失败', err.message)
      }
    },
  })

  // Mutation：移除成员
  const removeMemberMutation = useMutation({
    mutationFn: (data: { teamId: string; memberId: string }) =>
      trpc.teams.removeMember.mutate(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['teams', 'members', data.teamId] })
      const previousMembers = queryClient.getQueryData<TeamMember[]>([
        'teams',
        'members',
        data.teamId,
      ])
      queryClient.setQueryData<TeamMember[]>(['teams', 'members', data.teamId], (old) =>
        old?.filter((m) => m.id !== data.memberId),
      )
      return { previousMembers }
    },
    onSuccess: () => {
      toast.success('移除成功', '成员已移除')
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['teams', 'members', variables.teamId], context?.previousMembers)
      log.error('Failed to remove member:', err)
      if (isTRPCClientError(err)) {
        toast.error('移除成员失败', err.message)
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'members', variables.teamId] })
    },
  })

  // 包装函数以保持 API 兼容性
  const createTeam = (data: Parameters<typeof createMutation.mutateAsync>[0]) =>
    createMutation.mutateAsync(data)

  const updateTeam = (
    teamId: string,
    data: Omit<Parameters<typeof updateMutation.mutateAsync>[0], 'teamId'>,
  ) => updateMutation.mutateAsync({ teamId, ...data })

  const deleteTeam = (teamId: string) => deleteMutation.mutateAsync(teamId)

  const addMember = (teamId: string, data: { userId: string; role: 'lead' | 'member' }) =>
    addMemberMutation.mutateAsync({ teamId, ...data })

  const updateMemberRole = (teamId: string, memberId: string, role: 'lead' | 'member') =>
    updateMemberRoleMutation.mutateAsync({ teamId, memberId, role })

  const removeMember = (teamId: string, memberId: string) =>
    removeMemberMutation.mutateAsync({ teamId, memberId })

  return {
    // 状态
    teams,
    currentTeam,
    members,
    loading,
    error,

    // 计算属性
    hasTeams,
    currentTeamId,

    // 方法
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    updateMemberRole,
    removeMember,

    // Mutation 状态
    isCreating: computed(() => createMutation.isPending.value),
    isUpdating: computed(() => updateMutation.isPending.value),
    isDeleting: computed(() => deleteMutation.isPending.value),
  }
}
