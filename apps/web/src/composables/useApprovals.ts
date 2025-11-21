import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type RouterInput = inferRouterInputs<AppRouter>
type Deployment = RouterOutput['deployments']['list'][number]

interface DeploymentApproval {
  id: string
  deploymentId: string
  approverId: string
  status: 'pending' | 'approved' | 'rejected'
  comments?: string | null
  decidedAt?: Date | null
  createdAt: Date
  deployment?: Deployment
  approver?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
  }
}

interface ApprovalSummary {
  total: number
  approved: number
  rejected: number
  pending: number
  isComplete: boolean
  isApproved: boolean
  isRejected: boolean
}

/**
 * 部署审批管理组合式函数
 * 提供审批的查询、批准和拒绝功能
 */
export function useApprovals() {
  const toast = useToast()

  // 状态
  const pendingApprovals = ref<DeploymentApproval[]>([])
  const approvalHistory = ref<DeploymentApproval[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasPendingApprovals = computed(() => pendingApprovals.value.length > 0)
  const pendingCount = computed(() => pendingApprovals.value.length)

  /**
   * 获取待审批的部署列表
   * 通过查询部署列表并筛选需要审批的部署
   */
  async function listPendingApprovals(filters?: {
    projectId?: string
    environmentId?: string
    approverId?: string
  }) {
    loading.value = true
    error.value = null

    try {
      // 获取所有部署列表
      const deployments = await trpc.deployments.list.query({
        projectId: filters?.projectId,
        environmentId: filters?.environmentId,
        status: 'pending',
      })

      // 筛选出需要审批的部署（状态为 pending 且环境为 production）
      const pendingDeployments = deployments.filter((d: any) => {
        // 这里可以添加更多筛选逻辑
        return d.status === 'pending'
      })

      // 将部署转换为审批格式
      // 注意：这是一个简化版本，实际应该从后端获取审批记录
      pendingApprovals.value = pendingDeployments.map((d: any) => ({
        id: d.id, // 使用部署ID作为临时ID
        deploymentId: d.id,
        approverId: filters?.approverId || '',
        status: 'pending' as const,
        createdAt: new Date(d.createdAt),
        deployment: d,
      }))

      return pendingApprovals.value
    } catch (err) {
      console.error('Failed to fetch pending approvals:', err)
      error.value = '获取待审批列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取待审批列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取审批历史记录
   */
  async function listApprovalHistory(filters?: {
    projectId?: string
    environmentId?: string
    approverId?: string
  }) {
    loading.value = true
    error.value = null

    try {
      // 获取已完成的部署列表
      const deployments = await trpc.deployments.list.query({
        projectId: filters?.projectId,
        environmentId: filters?.environmentId,
      })

      // 筛选出已审批的部署
      const completedDeployments = deployments.filter(
        (d: any) => d.status === 'success' || d.status === 'failed' || d.status === 'cancelled',
      )

      // 将部署转换为审批格式
      approvalHistory.value = completedDeployments.map((d: any) => ({
        id: d.id,
        deploymentId: d.id,
        approverId: filters?.approverId || '',
        status:
          d.status === 'success'
            ? ('approved' as const)
            : d.status === 'failed'
              ? ('rejected' as const)
              : ('pending' as const),
        createdAt: new Date(d.createdAt),
        deployment: d,
      }))

      return approvalHistory.value
    } catch (err) {
      console.error('Failed to fetch approval history:', err)
      error.value = '获取审批历史失败'

      if (isTRPCClientError(err)) {
        toast.error('获取审批历史失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 批准部署
   */
  async function approve(deploymentId: string, comment?: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.deployments.approve.mutate({
        deploymentId,
        comment,
      })

      // 从待审批列表中移除
      pendingApprovals.value = pendingApprovals.value.filter((a) => a.deploymentId !== deploymentId)

      toast.success('审批成功', '部署已批准')
      return result
    } catch (err) {
      console.error('Failed to approve deployment:', err)
      error.value = '批准部署失败'

      if (isTRPCClientError(err)) {
        toast.error('批准部署失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 拒绝部署
   */
  async function reject(deploymentId: string, reason: string) {
    if (!reason || reason.trim() === '') {
      toast.error('拒绝失败', '请提供拒绝原因')
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await trpc.deployments.reject.mutate({
        deploymentId,
        reason,
      })

      // 从待审批列表中移除
      pendingApprovals.value = pendingApprovals.value.filter((a) => a.deploymentId !== deploymentId)

      toast.success('拒绝成功', '部署已拒绝')
      return result
    } catch (err) {
      console.error('Failed to reject deployment:', err)
      error.value = '拒绝部署失败'

      if (isTRPCClientError(err)) {
        toast.error('拒绝部署失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取部署的审批状态
   * 注意：这个方法需要后端支持，目前返回模拟数据
   */
  async function getApprovalStatus(deploymentId: string): Promise<{
    approvals: DeploymentApproval[]
    summary: ApprovalSummary
  }> {
    loading.value = true
    error.value = null

    try {
      // 获取部署详情
      const deployment = await trpc.deployments.get.query({ deploymentId })

      // 模拟审批状态（实际应该从后端获取）
      const mockApprovals: DeploymentApproval[] = deployment
        ? [
            {
              id: `${deploymentId}-1`,
              deploymentId,
              approverId: 'user-1',
              status: deployment.status === 'success' ? 'approved' : 'pending',
              createdAt: new Date(deployment.createdAt),
              deployment,
            },
          ]
        : []

      const summary: ApprovalSummary = {
        total: mockApprovals.length,
        approved: mockApprovals.filter((a) => a.status === 'approved').length,
        rejected: mockApprovals.filter((a) => a.status === 'rejected').length,
        pending: mockApprovals.filter((a) => a.status === 'pending').length,
        isComplete: mockApprovals.every((a) => a.status !== 'pending'),
        isApproved: mockApprovals.every((a) => a.status === 'approved'),
        isRejected: mockApprovals.some((a) => a.status === 'rejected'),
      }

      return {
        approvals: mockApprovals,
        summary,
      }
    } catch (err) {
      console.error('Failed to get approval status:', err)
      error.value = '获取审批状态失败'

      if (isTRPCClientError(err)) {
        toast.error('获取审批状态失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量批准部署
   */
  async function batchApprove(deploymentIds: string[], comment?: string) {
    loading.value = true
    error.value = null

    try {
      const results = await Promise.allSettled(deploymentIds.map((id) => approve(id, comment)))

      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length

      if (failCount > 0) {
        toast.warning('批量审批完成', `成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        toast.success('批量审批成功', `已批准 ${successCount} 个部署`)
      }

      return results
    } catch (err) {
      console.error('Failed to batch approve:', err)
      error.value = '批量批准失败'

      if (isTRPCClientError(err)) {
        toast.error('批量批准失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量拒绝部署
   */
  async function batchReject(deploymentIds: string[], reason: string) {
    if (!reason || reason.trim() === '') {
      toast.error('拒绝失败', '请提供拒绝原因')
      return
    }

    loading.value = true
    error.value = null

    try {
      const results = await Promise.allSettled(deploymentIds.map((id) => reject(id, reason)))

      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length

      if (failCount > 0) {
        toast.warning('批量拒绝完成', `成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        toast.success('批量拒绝成功', `已拒绝 ${successCount} 个部署`)
      }

      return results
    } catch (err) {
      console.error('Failed to batch reject:', err)
      error.value = '批量拒绝失败'

      if (isTRPCClientError(err)) {
        toast.error('批量拒绝失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新待审批列表
   */
  async function refresh(filters?: {
    projectId?: string
    environmentId?: string
    approverId?: string
  }) {
    await listPendingApprovals(filters)
  }

  /**
   * 获取审批状态的显示文本
   */
  function getStatusLabel(status: 'pending' | 'approved' | 'rejected'): string {
    const labels = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
    }
    return labels[status]
  }

  /**
   * 获取审批状态的颜色
   */
  function getStatusColor(status: 'pending' | 'approved' | 'rejected'): string {
    const colors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
    }
    return colors[status]
  }

  return {
    // 状态
    pendingApprovals,
    approvalHistory,
    loading,
    error,

    // 计算属性
    hasPendingApprovals,
    pendingCount,

    // 方法 - 查询
    listPendingApprovals,
    listApprovalHistory,
    getApprovalStatus,

    // 方法 - 审批操作
    approve,
    reject,
    batchApprove,
    batchReject,

    // 方法 - 工具
    refresh,
    getStatusLabel,
    getStatusColor,
  }
}
