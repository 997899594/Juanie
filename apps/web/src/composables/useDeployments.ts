import { log } from '@juanie/ui'
import type { inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

type RouterOutput = inferRouterOutputs<AppRouter>
type Deployment = RouterOutput['deployments']['list'][number]

export function useDeployments() {
  const toast = useToast()

  const deployments = ref<Deployment[]>([])
  const currentDeployment = ref<Deployment | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取部署列表
  async function fetchDeployments(filters?: {
    projectId?: string
    environmentId?: string
    status?: string
  }) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.deployments.list.query(filters || {})
      deployments.value = result
      return result
    } catch (err) {
      log.error('Failed to fetch deployments:', err)
      error.value = '获取部署列表失败'
      if (isTRPCClientError(err)) {
        toast.error('获取部署列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取部署详情
  async function fetchDeployment(deploymentId: string) {
    loading.value = true
    try {
      const result = await trpc.deployments.get.query({ deploymentId })
      currentDeployment.value = result
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('获取部署详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建部署
  async function createDeployment(data: any) {
    loading.value = true
    try {
      const result = await trpc.deployments.create.mutate(data)
      toast.success('部署创建成功')
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('创建失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 批准部署
  async function approveDeployment(deploymentId: string, comment?: string) {
    loading.value = true
    try {
      await trpc.deployments.approve.mutate({ deploymentId, comment })
      toast.success('部署已批准')
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('批准失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 拒绝部署
  async function rejectDeployment(deploymentId: string, reason: string) {
    loading.value = true
    try {
      await trpc.deployments.reject.mutate({ deploymentId, reason })
      toast.success('部署已拒绝')
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('拒绝失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 回滚部署
  async function rollbackDeployment(deploymentId: string) {
    loading.value = true
    try {
      await trpc.deployments.rollback.mutate({ deploymentId })
      toast.success('部署已回滚')
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('回滚失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    deployments: computed(() => deployments.value),
    currentDeployment: computed(() => currentDeployment.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchDeployments,
    fetchDeployment,
    createDeployment,
    approveDeployment,
    rejectDeployment,
    rollbackDeployment,
  }
}
