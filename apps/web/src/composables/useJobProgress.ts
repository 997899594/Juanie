import { onUnmounted, ref } from 'vue'
import { useToast } from './useToast'

export interface JobProgress {
  jobId: string
  state: string
  progress: number
  logs: string[]
  timestamp: number
}

export function useJobProgress() {
  const toast = useToast()
  const progress = ref<JobProgress | null>(null)
  const isConnected = ref(false)
  const error = ref<string | null>(null)

  let eventSource: EventSource | null = null

  const connect = (jobId: string) => {
    if (eventSource) {
      eventSource.close()
    }

    const url = `${import.meta.env.VITE_API_URL}/sse/jobs/${jobId}`
    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      isConnected.value = true
      error.value = null
    }

    // 监听连接成功
    eventSource.addEventListener('connected', (e) => {
      console.log('SSE connected:', e.data)
    })

    // 监听任务进度
    eventSource.addEventListener('job.progress', (e) => {
      try {
        progress.value = JSON.parse(e.data)
      } catch (err) {
        console.error('Failed to parse progress:', err)
      }
    })

    // 监听任务完成
    eventSource.addEventListener('job.completed', (e) => {
      try {
        const data = JSON.parse(e.data)
        progress.value = {
          jobId: data.jobId,
          state: 'completed',
          progress: 100,
          logs: [],
          timestamp: data.timestamp,
        }
        toast.success('任务完成', '操作已成功完成')
        disconnect()
      } catch (err) {
        console.error('Failed to parse completed:', err)
      }
    })

    // 监听任务失败
    eventSource.addEventListener('job.failed', (e) => {
      try {
        const data = JSON.parse(e.data)
        error.value = data.error || '任务失败'
        toast.error('任务失败', error.value)
        disconnect()
      } catch (err) {
        console.error('Failed to parse failed:', err)
      }
    })

    eventSource.addEventListener('error', (e: any) => {
      try {
        if (e.data) {
          const data = JSON.parse(e.data)
          error.value = data.message || '连接错误'
        } else {
          error.value = 'SSE 连接错误'
        }
      } catch (err) {
        error.value = 'SSE 连接错误'
      }
      disconnect()
    })

    eventSource.onerror = () => {
      isConnected.value = false
      // EventSource 会自动重连，除非手动关闭
    }
  }

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    isConnected.value = false
  }

  // 组件卸载时清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    progress,
    isConnected,
    error,
    connect,
    disconnect,
  }
}
