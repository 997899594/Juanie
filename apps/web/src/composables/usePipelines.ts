import { log } from '@juanie/ui'
import type { inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'
import { useToast } from './useToast'

type RouterOutput = inferRouterOutputs<AppRouter>
type Pipeline = RouterOutput['pipelines']['list'][number]
type PipelineRun = RouterOutput['pipelines']['getRun']

export function usePipelines() {
  const toast = useToast()

  const pipelines = ref<Pipeline[]>([])
  const runs = ref<PipelineRun[]>([])
  const currentRun = ref<PipelineRun | null>(null)
  const logs = ref<Array<{ timestamp: string; message: string }>>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取项目的 Pipeline 列表
  async function fetchPipelines(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.pipelines.list.query({ projectId })
      pipelines.value = result
      return result
    } catch (err) {
      log.error('Failed to fetch pipelines:', err)
      error.value = '获取 Pipeline 列表失败'
      if (isTRPCClientError(err)) {
        toast.error('获取 Pipeline 列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建 Pipeline
  async function createPipeline(data: any) {
    loading.value = true
    try {
      const result = await trpc.pipelines.create.mutate(data)
      toast.success('Pipeline 创建成功')
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

  // 更新 Pipeline
  async function updatePipeline(pipelineId: string, data: any) {
    loading.value = true
    try {
      const result = await trpc.pipelines.update.mutate({ pipelineId, ...data })
      toast.success('Pipeline 更新成功')
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('更新失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除 Pipeline
  async function deletePipeline(pipelineId: string) {
    loading.value = true
    try {
      await trpc.pipelines.delete.mutate({ pipelineId })
      toast.success('Pipeline 删除成功')
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('删除失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 触发 Pipeline
  async function triggerPipeline(
    pipelineId: string,
    data?: { branch?: string; commitHash?: string },
  ) {
    loading.value = true
    try {
      const result = await trpc.pipelines.trigger.mutate({ pipelineId, ...data })
      toast.success('Pipeline 已触发')
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('触发失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 取消 Pipeline 运行
  async function cancelRun(runId: string) {
    loading.value = true
    try {
      await trpc.pipelines.cancel.mutate({ runId })
      toast.success('Pipeline 已取消')
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('取消失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取 Pipeline 运行列表
  async function fetchRuns(pipelineId: string) {
    loading.value = true
    try {
      const result = await trpc.pipelines.listRuns.query({ pipelineId })
      runs.value = result
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('获取运行列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取运行详情
  async function fetchRun(runId: string) {
    loading.value = true
    try {
      const result = await trpc.pipelines.getRun.query({ runId })
      currentRun.value = result
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('获取运行详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取日志
  async function fetchLogs(runId: string) {
    loading.value = true
    try {
      const result = await trpc.pipelines.getLogs.query({ runId })
      return result
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('获取日志失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 订阅实时日志流
  function subscribeToLogs(
    runId: string,
    onData: (log: { timestamp: string; message: string }) => void,
  ) {
    try {
      const subscription = trpc.pipelines.streamLogs.subscribe(
        { runId },
        {
          onData,
          onError: (err: any) => {
            log.error('日志订阅失败:', err)
            toast.error('日志订阅失败')
          },
        },
      )
      return subscription
    } catch (err) {
      log.error('Failed to subscribe to logs:', err)
      toast.error('日志订阅失败')
      return undefined
    }
  }

  // 订阅实时状态更新
  function subscribeToStatus(
    runId: string,
    onData: (status: { status: string; progress?: number }) => void,
  ) {
    try {
      const subscription = trpc.pipelines.watchRun.subscribe(
        { runId },
        {
          onData,
          onError: (err: any) => {
            log.error('状态订阅失败:', err)
            toast.error('状态订阅失败')
          },
        },
      )
      return subscription
    } catch (err) {
      log.error('Failed to subscribe to status:', err)
      toast.error('状态订阅失败')
      return undefined
    }
  }

  return {
    pipelines: computed(() => pipelines.value),
    runs: computed(() => runs.value),
    currentRun: computed(() => currentRun.value),
    logs: computed(() => logs.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchPipelines,
    createPipeline,
    updatePipeline,
    deletePipeline,
    triggerPipeline,
    cancelRun,
    fetchRuns,
    fetchRun,
    fetchLogs,
    subscribeToLogs,
    subscribeToStatus,
  }
}
