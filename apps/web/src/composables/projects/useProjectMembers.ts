import { log } from '@juanie/ui'
import type { inferRouterOutputs } from '@trpc/server'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type ProjectMember = RouterOutput['projects']['listMembers'][number]

/**
 * 项目成员管理
 */
export function useProjectMembers() {
  const toast = useToast()
  const members = ref<ProjectMember[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMembers(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.listMembers.query({ projectId })
      members.value = result
      return result
    } catch (err) {
      log.error('Failed to fetch members:', err)
      error.value = '获取成员列表失败'
      if (isTRPCClientError(err)) {
        toast.error('获取成员列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addMember(
    projectId: string,
    data: { memberId: string; role: 'admin' | 'developer' | 'viewer' },
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.addMember.mutate({ projectId, ...data })
      await fetchMembers(projectId)
      toast.success('添加成功', '成员已添加到项目')
      return result
    } catch (err) {
      log.error('Failed to add member:', err)
      error.value = '添加成员失败'
      if (isTRPCClientError(err)) {
        toast.error('添加成员失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateMemberRole(
    projectId: string,
    memberId: string,
    role: 'admin' | 'developer' | 'viewer',
  ) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.updateMemberRole.mutate({ projectId, memberId, role })
      await fetchMembers(projectId)
      toast.success('更新成功', '成员角色已更新')
    } catch (err) {
      log.error('Failed to update member role:', err)
      error.value = '更新成员角色失败'
      if (isTRPCClientError(err)) {
        toast.error('更新成员角色失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function removeMember(projectId: string, memberId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.removeMember.mutate({ projectId, memberId })
      members.value = members.value.filter((m) => m.id !== memberId)
      toast.success('移除成功', '成员已移除')
    } catch (err) {
      log.error('Failed to remove member:', err)
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
    members,
    loading,
    error,
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,
  }
}
