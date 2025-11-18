/**
 * SSE 事件类型定义
 */

export type SSEEventType =
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'project.status'
  | 'deployment.status'
  | 'notification'

export interface SSEEvent<T = any> {
  type: SSEEventType
  channel: string // 事件频道，如 "job:123" 或 "project:abc"
  data: T
  timestamp: number
}

// 任务进度事件
export interface JobProgressEvent {
  jobId: string
  progress: number
  state: 'waiting' | 'active' | 'completed' | 'failed'
  logs?: string[]
}

// 任务完成事件
export interface JobCompletedEvent {
  jobId: string
  result: any
}

// 任务失败事件
export interface JobFailedEvent {
  jobId: string
  error: string
}

// 项目状态事件
export interface ProjectStatusEvent {
  projectId: string
  status: string
  progress: number
  step: string
  completedSteps: string[]
}
