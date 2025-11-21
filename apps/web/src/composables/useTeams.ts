import type { inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type Team = RouterOutput['teams']['list'][number]
type TeamDetail = RouterOutput['teams']['get']
type TeamMember = RouterOutput['teams']['listMembers'][number]

/**
 * 团队管理组合式函数
 * 提供团队的 CRUD 操作和成员管理
 */
export function useTeams() {
  const toast = useToast()

  // 状态
  const teams = ref<Team[]>([])
  const currentTeam = ref<TeamDetail | null>(null)
  const members = ref<TeamMember[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasTeams = computed(() => teams.value.length > 0)
  const currentTeamId = computed(() => currentTeam.value?.id)

  /**
   * 获取组织的团队列表
   */
  async function fetchTeams(organizationId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.teams.list.query({ organizationId })
      teams.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch teams:', err)
      error.value = '获取团队列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取团队列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取团队详情
   */
  async function fetchTeam(teamId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.teams.get.query({ teamId })
      currentTeam.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch team:', err)
      error.value = '获取团队详情失败'

      if (isTRPCClientError(err)) {
        toast.error('获取团队详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建团队
   */
  async function createTeam(data: {
    organizationId: string
    name: string
    slug?: string
    description?: string
  }) {
    loading.value = true
    error.value = null

    try {
      // 如果没有提供 slug，从 name 生成
      const slug =
        data.slug ||
        data.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      const result = await trpc.teams.create.mutate({
        ...data,
        slug,
      })

      // 刷新团队列表
      await fetchTeams(data.organizationId)

      toast.success('创建成功', `团队 "${data.name}" 已创建`)
      return result
    } catch (err) {
      console.error('Failed to create team:', err)
      error.value = '创建团队失败'

      if (isTRPCClientError(err)) {
        toast.error('创建团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新团队
   */
  async function updateTeam(
    teamId: string,
    data: {
      name?: string
      description?: string
    },
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.teams.update.mutate({
        teamId,
        ...data,
      })

      // 更新本地数据
      if (currentTeam.value?.id === teamId) {
        currentTeam.value = { ...currentTeam.value, ...result }
      }

      // 更新列表中的团队
      const teamIndex = teams.value.findIndex((t: any) => t.id === teamId)
      if (teamIndex !== -1 && teams.value[teamIndex]) {
        teams.value[teamIndex] = { ...teams.value[teamIndex], ...result }
      }

      toast.success('更新成功', '团队信息已更新')
      return result
    } catch (err) {
      console.error('Failed to update team:', err)
      error.value = '更新团队失败'

      if (isTRPCClientError(err)) {
        toast.error('更新团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除团队
   */
  async function deleteTeam(teamId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.teams.delete.mutate({ teamId })

      // 更新本地列表
      teams.value = teams.value.filter((t: any) => t.id !== teamId)

      if (currentTeam.value?.id === teamId) {
        currentTeam.value = null
      }

      toast.success('删除成功', '团队已删除')
    } catch (err) {
      console.error('Failed to delete team:', err)
      error.value = '删除团队失败'

      if (isTRPCClientError(err)) {
        toast.error('删除团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取团队成员列表
   */
  async function fetchMembers(teamId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.teams.listMembers.query({ teamId })
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
   * 添加团队成员
   */
  async function addMember(
    teamId: string,
    data: {
      userId: string
      role: 'lead' | 'member'
    },
  ) {
    loading.value = true
    error.value = null

    try {
      // 将 lead 映射到 maintainer，因为 API 使用不同的角色名称
      const apiRole = data.role === 'lead' ? 'maintainer' : 'member'
      const result = await trpc.teams.addMember.mutate({
        teamId,
        userId: data.userId, // addMember 使用 userId，不是 memberId
        role: apiRole as 'member' | 'owner' | 'maintainer',
      })

      // 刷新成员列表
      await fetchMembers(teamId)

      toast.success('添加成功', '成员已添加到团队')
      return result
    } catch (err) {
      console.error('Failed to add member:', err)
      error.value = '添加成员失败'

      if (isTRPCClientError(err)) {
        toast.error('添加成员失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新成员角色
   */
  async function updateMemberRole(teamId: string, memberId: string, role: 'lead' | 'member') {
    loading.value = true
    error.value = null

    try {
      // 将 lead 映射到 maintainer，因为 API 使用不同的角色名称
      const apiRole = role === 'lead' ? 'maintainer' : 'member'
      await trpc.teams.updateMemberRole.mutate({
        teamId,
        memberId,
        role: apiRole as 'member' | 'owner' | 'maintainer',
      })

      // 刷新成员列表以获取最新数据
      await fetchMembers(teamId)

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
   * 移除团队成员
   */
  async function removeMember(teamId: string, memberId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.teams.removeMember.mutate({
        teamId,
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
    fetchTeams,
    fetchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,
  }
}
