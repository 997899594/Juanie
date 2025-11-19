import { onUnmounted, ref } from 'vue'
import { trpc } from '@/lib/trpc'

export interface JobProgress {
  jobId: string
  progress: number
  state: 'waiting' | 'active' | 'completed' | 'failed'
  logs: string[]
}

/**
 * 监听任务进度的 composable
 */
export function useJobProgress() {
  const jobProgress = ref<JobProgress | null>(null)
  const isConnected = ref(false)
  let unsubscribe: { unsubscribe: () => void } | null = null

  /**
   * 连接到任务进度流
   */
  function connectToJob(jobId: string) {
    if (unsubscribe) {
      disconnectJob()
    }

    jobProgress.value = {
      jobId,
      progress: 0,
      state: 'waiting',
      logs: [],
    }

    isConnected.value = true

    // 使用 tRPC subscription 监听任务进度
    try {
      unsubscribe = trpc.projects.onJobProgress.subscribe(
        { jobId },
        {
          onData: (event: any) => {
            console.log('Job progress event:', event)

            if (!jobProgress.value) return

            if (event.type === 'job.progress') {
              jobProgress.value.progress = event.data.progress || 0
              jobProgress.value.state = event.data.state || 'active'
              if (event.data.logs) {
                jobProgress.value.logs = event.data.logs
              }
            } else if (event.type === 'job.completed') {
              jobProgress.value.progress = 100
              jobProgress.value.state = 'completed'
              jobProgress.value.logs.push('任务完成')
            } else if (event.type === 'job.failed') {
              jobProgress.value.state = 'failed'
              jobProgress.value.logs.push(`任务失败: ${event.data.error || '未知错误'}`)
            }
          },
          onError: (err: any) => {
            console.error('Job progress subscription error:', err)
            if (jobProgress.value) {
              jobProgress.value.state = 'failed'
              jobProgress.value.logs.push('连接失败')
            }
            isConnected.value = false
          },
        },
      )
    } catch (error) {
      console.error('Failed to connect to job:', error)
      isConnected.value = false
    }
  }

  /**
   * 断开任务进度流
   */
  function disconnectJob() {
    if (unsubscribe) {
      unsubscribe.unsubscribe()
      unsubscribe = null
    }
    isConnected.value = false
  }

  /**
   * 重置状态
   */
  function reset() {
    disconnectJob()
    jobProgress.value = null
  }

  // 组件卸载时自动断开连接
  onUnmounted(() => {
    disconnectJob()
  })

  return {
    jobProgress,
    isConnected,
    connectToJob,
    disconnectJob,
    reset,
  }
}
