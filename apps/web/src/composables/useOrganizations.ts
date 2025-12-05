import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { inferRouterOutputs } from '@trpc/server'
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type Organization = RouterOutput['organizations']['list'][number]
type OrganizationMember = RouterOutput['organizations']['listMembers'][number]

/**
 * 组织管理组合式函数
 * 提供组织的 CRUD 操作和成员管理
 */
export function useOrganizations(orgId?: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  // 查询：组织列表
  const {
    data: organizations,
    isLoading: isLoadingList,
    error: listError,
  } = useQuery({
    queryKey: ['organizations', 'list'],
    queryFn: () => trpc.organizations.list.query(),
  })

  // 查询：组织详情
  const {
    data: currentOrganization,
    isLoading: isLoadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ['organizations', 'detail', orgId],
    queryFn: () => trpc.organizations.get.query({ orgId: orgId! }),
    enabled: !!orgId,
  })

  // 查询：组织成员
  const {
    data: members,
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ['organizations', 'members', orgId],
    queryFn: () => trpc.organizations.listMembers.query({ orgId: orgId! }),
    enabled: !!orgId,
  })

  // 查询：配额使用情况
  const {
    data: quotaUsage,
    isLoading: isLoadingQuota,
    error: quotaError,
  } = useQuery({
    queryKey: ['organizations', 'quota', orgId],
    queryFn: () => trpc.organizations.getQuotaUsage.query({ orgId: orgId! }),
    enabled: !!orgId,
  })

  // 计算属性
  const hasOrganizations = computed(() => (organizations.value?.length ?? 0) > 0)
  const currentOrgId = computed(() => currentOrganization.value?.id)
  const loading = computed(
    () =>
      isLoadingList.value ||
      isLoadingDetail.value ||
      isLoadingMembers.value ||
      isLoadingQuota.value,
  )
  const error = computed(
    () => listError.value || detailError.value || membersError.value || quotaError.value,
  )

  // Mutation：创建组织
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      displayName?: string
      gitSyncEnabled?: boolean
      gitProvider?: 'github' | 'gitlab'
      gitOrgName?: string
    }) => trpc.organizations.create.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
      toast.success('创建成功', `组织 "${variables.name}" 已创建`)
    },
    onError: (err) => {
      log.error('Failed to create organization:', err)
      const errorMessage = isTRPCClientError(err) ? err.message : '创建组织失败，请稍后重试'
      toast.error('创建组织失败', errorMessage)
    },
  })

  // Mutation：更新组织
  const updateMutation = useMutation({
    mutationFn: (data: { orgId: string; name?: string; slug?: string; displayName?: string }) =>
      trpc.organizations.update.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', 'detail', variables.orgId] })
      toast.success('更新成功', '组织信息已更新')
    },
    onError: (err) => {
      log.error('Failed to update organization:', err)
      if (isTRPCClientError(err)) {
        toast.error('更新组织失败', err.message)
      }
    },
  })

  // Mutation：删除组织
  const deleteMutation = useMutation({
    mutationFn: (orgId: string) => trpc.organizations.delete.mutate({ orgId }),
    onMutate: async (orgId) => {
      await queryClient.cancelQueries({ queryKey: ['organizations', 'list'] })
      const previousOrgs = queryClient.getQueryData<Organization[]>(['organizations', 'list'])
      queryClient.setQueryData<Organization[]>(['organizations', 'list'], (old) =>
        old?.filter((org) => org.id !== orgId),
      )
      return { previousOrgs }
    },
    onSuccess: () => {
      toast.success('删除成功', '组织已删除')
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['organizations', 'list'], context?.previousOrgs)
      log.error('Failed to delete organization:', err)
      if (isTRPCClientError(err)) {
        toast.error('删除组织失败', err.message)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
    },
  })

  // Mutation：邀请成员
  const inviteMemberMutation = useMutation({
    mutationFn: (data: { orgId: string; invitedUserId: string; role: 'admin' | 'member' }) =>
      trpc.organizations.inviteMember.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'members', variables.orgId] })
      toast.success('邀请成功', '成员已添加到组织')
    },
    onError: (err) => {
      log.error('Failed to invite member:', err)
      if (isTRPCClientError(err)) {
        toast.error('邀请成员失败', err.message)
      }
    },
  })

  // Mutation：更新成员角色
  const updateMemberRoleMutation = useMutation({
    mutationFn: (data: { orgId: string; memberId: string; role: 'admin' | 'member' }) =>
      trpc.organizations.updateMemberRole.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'members', variables.orgId] })
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
    mutationFn: (data: { orgId: string; memberId: string }) =>
      trpc.organizations.removeMember.mutate(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['organizations', 'members', data.orgId] })
      const previousMembers = queryClient.getQueryData<OrganizationMember[]>([
        'organizations',
        'members',
        data.orgId,
      ])
      queryClient.setQueryData<OrganizationMember[]>(
        ['organizations', 'members', data.orgId],
        (old) => old?.filter((m) => m.id !== data.memberId),
      )
      return { previousMembers }
    },
    onSuccess: () => {
      toast.success('移除成功', '成员已移除')
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        ['organizations', 'members', variables.orgId],
        context?.previousMembers,
      )
      log.error('Failed to remove member:', err)
      if (isTRPCClientError(err)) {
        toast.error('移除成员失败', err.message)
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'members', variables.orgId] })
    },
  })

  // 包装函数以保持 API 兼容性
  const createOrganization = (data: Parameters<typeof createMutation.mutateAsync>[0]) =>
    createMutation.mutateAsync(data)

  const updateOrganization = (
    orgId: string,
    data: Omit<Parameters<typeof updateMutation.mutateAsync>[0], 'orgId'>,
  ) => updateMutation.mutateAsync({ orgId, ...data })

  const deleteOrganization = (orgId: string) => deleteMutation.mutateAsync(orgId)

  const inviteMember = (orgId: string, invitedUserId: string, role: 'admin' | 'member') =>
    inviteMemberMutation.mutateAsync({ orgId, invitedUserId, role })

  const updateMemberRole = (orgId: string, memberId: string, role: 'admin' | 'member') =>
    updateMemberRoleMutation.mutateAsync({ orgId, memberId, role })

  const removeMember = (orgId: string, memberId: string) =>
    removeMemberMutation.mutateAsync({ orgId, memberId })

  return {
    // 状态
    organizations,
    currentOrganization,
    members,
    quotaUsage,
    loading,
    error,

    // 计算属性
    hasOrganizations,
    currentOrgId,

    // 方法
    createOrganization,
    updateOrganization,
    deleteOrganization,
    inviteMember,
    updateMemberRole,
    removeMember,

    // Mutation 状态
    isCreating: computed(() => createMutation.isPending.value),
    isUpdating: computed(() => updateMutation.isPending.value),
    isDeleting: computed(() => deleteMutation.isPending.value),
  }
}
