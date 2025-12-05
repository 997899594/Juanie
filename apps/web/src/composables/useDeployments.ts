import { log } from '@juanie/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useDeployments(filters?: {
  projectId?: string
  environmentId?: string
  status?: string
}) {
  const toast = useToast()
  const queryClient = useQueryClient()

  // 查询：部署列表
  const {
    data: deployments,
    isLoading: isLoadingList,
    error: listError,
  } = useQuery({
    queryKey: ['deployments', 'list', filters],
    queryFn: () => trpc.deployments.list.query(filters || {}),
  })

  // 查询：部署详情（需要单独调用）
  const fetchDeployment = (deploymentId: string) =>
    useQuery({
      queryKey: ['deployments', 'detail', deploymentId],
      queryFn: () => trpc.deployments.get.query({ deploymentId }),
    })

  // Mutation：创建部署
  const createMutation = useMutation({
    mutationFn: (data: any) => trpc.deployments.create.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments', 'list'] })
      toast.success('部署创建成功')
    },
    onError: (err) => {
      log.error('Failed to create deployment:', err)
      if (isTRPCClientError(err)) {
        toast.error('创建失败', err.message)
      }
    },
  })

  // Mutation：批准部署
  const approveMutation = useMutation({
    mutationFn: (data: { deploymentId: string; comment?: string }) =>
      trpc.deployments.approve.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['deployments', 'detail', variables.deploymentId] })
      toast.success('部署已批准')
    },
    onError: (err) => {
      log.error('Failed to approve deployment:', err)
      if (isTRPCClientError(err)) {
        toast.error('批准失败', err.message)
      }
    },
  })

  // Mutation：拒绝部署
  const rejectMutation = useMutation({
    mutationFn: (data: { deploymentId: string; reason: string }) =>
      trpc.deployments.reject.mutate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['deployments', 'detail', variables.deploymentId] })
      toast.success('部署已拒绝')
    },
    onError: (err) => {
      log.error('Failed to reject deployment:', err)
      if (isTRPCClientError(err)) {
        toast.error('拒绝失败', err.message)
      }
    },
  })

  // Mutation：回滚部署
  const rollbackMutation = useMutation({
    mutationFn: (deploymentId: string) => trpc.deployments.rollback.mutate({ deploymentId }),
    onSuccess: (_, deploymentId) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['deployments', 'detail', deploymentId] })
      toast.success('部署已回滚')
    },
    onError: (err) => {
      log.error('Failed to rollback deployment:', err)
      if (isTRPCClientError(err)) {
        toast.error('回滚失败', err.message)
      }
    },
  })

  // 包装函数以保持 API 兼容性
  const createDeployment = (data: any) => createMutation.mutateAsync(data)

  const approveDeployment = (deploymentId: string, comment?: string) =>
    approveMutation.mutateAsync({ deploymentId, comment })

  const rejectDeployment = (deploymentId: string, reason: string) =>
    rejectMutation.mutateAsync({ deploymentId, reason })

  const rollbackDeployment = (deploymentId: string) => rollbackMutation.mutateAsync(deploymentId)

  return {
    // 状态
    deployments: computed(() => deployments.value ?? []),
    loading: computed(() => isLoadingList.value),
    error: computed(() => listError.value),

    // 方法
    fetchDeployment,
    createDeployment,
    approveDeployment,
    rejectDeployment,
    rollbackDeployment,

    // Mutation 状态
    isCreating: computed(() => createMutation.isPending.value),
    isApproving: computed(() => approveMutation.isPending.value),
    isRejecting: computed(() => rejectMutation.isPending.value),
    isRollingBack: computed(() => rollbackMutation.isPending.value),
  }
}
