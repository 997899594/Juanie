import type { inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type Organization = RouterOutput['organizations']['list'][number]
type OrganizationDetail = RouterOutput['organizations']['get']
type OrganizationMember = RouterOutput['organizations']['listMembers'][number]
type QuotaUsage = RouterOutput['organizations']['getQuotaUsage']

/**
 * 组织管理组合式函数
 * 提供组织的 CRUD 操作和成员管理
 */
export function useOrganizations() {
  const toast = useToast()

  // 状态
  const organizations = ref<Organization[]>([])
  const currentOrganization = ref<OrganizationDetail | null>(null)
  const members = ref<OrganizationMember[]>([])
  const quotaUsage = ref<QuotaUsage | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasOrganizations = computed(() => organizations.value.length > 0)
  const currentOrgId = computed(() => currentOrganization.value?.id)

  /**
   * 获取组织列表
   */
  async function fetchOrganizations() {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.list.query()
      organizations.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch organizations:', err)
      error.value = '获取组织列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取组织列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取组织详情
   */
  async function fetchOrganization(orgId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.get.query({ orgId })
      currentOrganization.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch organization:', err)
      error.value = '获取组织详情失败'

      if (isTRPCClientError(err)) {
        toast.error('获取组织详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建组织
   */
  async function createOrganization(data: { name: string; slug: string; displayName?: string }) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.create.mutate(data)

      // 更新本地列表
      await fetchOrganizations()

      toast.success('创建成功', `组织 "${data.name}" 已创建`)
      return result
    } catch (err) {
      console.error('Failed to create organization:', err)
      error.value = '创建组织失败'

      if (isTRPCClientError(err)) {
        toast.error('创建组织失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新组织
   */
  async function updateOrganization(
    orgId: string,
    data: {
      name?: string
      slug?: string
      displayName?: string
    },
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.update.mutate({
        orgId,
        ...data,
      })

      // 更新本地数据
      if (currentOrganization.value?.id === orgId) {
        currentOrganization.value = { ...currentOrganization.value, ...result }
      }
      await fetchOrganizations()

      toast.success('更新成功', '组织信息已更新')
      return result
    } catch (err) {
      console.error('Failed to update organization:', err)
      error.value = '更新组织失败'

      if (isTRPCClientError(err)) {
        toast.error('更新组织失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除组织
   */
  async function deleteOrganization(orgId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.organizations.delete.mutate({ orgId })

      // 更新本地列表
      organizations.value = organizations.value.filter((org: any) => org.id !== orgId)

      if (currentOrganization.value?.id === orgId) {
        currentOrganization.value = null
      }

      toast.success('删除成功', '组织已删除')
    } catch (err) {
      console.error('Failed to delete organization:', err)
      error.value = '删除组织失败'

      if (isTRPCClientError(err)) {
        toast.error('删除组织失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取组织成员列表
   */
  async function fetchMembers(orgId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.listMembers.query({ orgId })
      members.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch members:', err)
      error.value = '获取成员列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取成员列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 邀请成员
   * @param orgId 组织 ID
   * @param invitedUserId 被邀请用户的 ID
   * @param role 角色（admin 或 member）
   */
  async function inviteMember(orgId: string, invitedUserId: string, role: 'admin' | 'member') {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.inviteMember.mutate({
        orgId,
        invitedUserId,
        role,
      })

      // 刷新成员列表
      await fetchMembers(orgId)

      toast.success('邀请成功', '成员已添加到组织')
      return result
    } catch (err) {
      console.error('Failed to invite member:', err)
      error.value = '邀请成员失败'

      if (isTRPCClientError(err)) {
        toast.error('邀请成员失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新成员角色
   * @param orgId 组织 ID
   * @param memberId 成员记录 ID
   * @param role 新角色（admin 或 member）
   */
  async function updateMemberRole(orgId: string, memberId: string, role: 'admin' | 'member') {
    loading.value = true
    error.value = null

    try {
      await trpc.organizations.updateMemberRole.mutate({
        orgId,
        memberId,
        role,
      })

      // 刷新成员列表以获取最新数据
      await fetchMembers(orgId)

      toast.success('更新成功', '成员角色已更新')
    } catch (err) {
      console.error('Failed to update member role:', err)
      error.value = '更新成员角色失败'

      if (isTRPCClientError(err)) {
        toast.error('更新成员角色失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 移除成员
   * @param orgId 组织 ID
   * @param memberId 成员记录 ID
   */
  async function removeMember(orgId: string, memberId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.organizations.removeMember.mutate({
        orgId,
        memberId,
      })

      // 更新本地成员列表
      members.value = members.value.filter((m: any) => m.id !== memberId)

      toast.success('移除成功', '成员已移除')
    } catch (err) {
      console.error('Failed to remove member:', err)
      error.value = '移除成员失败'

      if (isTRPCClientError(err)) {
        toast.error('移除成员失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取配额使用情况
   */
  async function fetchQuotaUsage(orgId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.organizations.getQuotaUsage.query({ orgId })
      quotaUsage.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch quota usage:', err)
      error.value = '获取配额信息失败'

      if (isTRPCClientError(err)) {
        toast.error('获取配额信息失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

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
    fetchOrganizations,
    fetchOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    fetchMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    fetchQuotaUsage,
  }
}
