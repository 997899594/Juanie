/**
 * 系统事件类型定义
 * 使用命名空间组织事件，便于管理和理解
 */

/**
 * K3s 相关事件
 */
export const K3sEvents = {
  /** K3s 连接成功 */
  CONNECTED: 'k3s.connected',
  /** K3s 连接失败 */
  CONNECTION_FAILED: 'k3s.connection.failed',
  /** K3s 断开连接 */
  DISCONNECTED: 'k3s.disconnected',
} as const

/**
 * Flux 相关事件
 */
export const FluxEvents = {
  /** Flux 安装完成 */
  INSTALLED: 'flux.installed',
  /** Flux 未安装 */
  NOT_INSTALLED: 'flux.not.installed',
  /** Flux 健康检查完成 */
  HEALTH_CHECKED: 'flux.health.checked',
} as const

/**
 * 项目初始化事件
 */
export const ProjectEvents = {
  /** 项目创建开始 */
  CREATION_STARTED: 'project.creation.started',
  /** 项目创建完成 */
  CREATION_COMPLETED: 'project.creation.completed',
  /** 项目创建失败 */
  CREATION_FAILED: 'project.creation.failed',
} as const

/**
 * 系统就绪事件
 */
export const SystemEvents = {
  /** 应用启动完成 */
  BOOTSTRAP_COMPLETE: 'system.bootstrap.complete',
  /** 所有服务就绪 */
  ALL_SERVICES_READY: 'system.all.services.ready',
} as const

/**
 * 事件 Payload 类型定义
 */
export interface K3sConnectedEvent {
  timestamp: Date
  kubeconfigPath?: string
}

export interface K3sConnectionFailedEvent {
  timestamp: Date
  error: string
  kubeconfigPath?: string
}

export interface FluxHealthCheckedEvent {
  timestamp: Date
  installed: boolean
  healthy?: boolean
}

/**
 * GitOps 相关事件
 */
export const GitOpsEvents = {
  /** GitOps 设置请求 */
  SETUP_REQUESTED: 'gitops.setup.requested',
  /** GitOps 设置开始 */
  SETUP_STARTED: 'gitops.setup.started',
  /** GitOps 设置完成 */
  SETUP_COMPLETED: 'gitops.setup.completed',
  /** GitOps 设置失败 */
  SETUP_FAILED: 'gitops.setup.failed',
} as const

export interface GitOpsSetupRequestedEvent {
  projectId: string
  repositoryId: string
  repositoryUrl: string
  repositoryBranch: string
  accessToken: string
  environments: Array<{
    id: string
    type: 'development' | 'staging' | 'production'
    name: string
  }>
  jobId?: string
}

export interface GitOpsSetupCompletedEvent {
  projectId: string
  namespaces: string[]
  gitRepositories: string[]
  kustomizations: string[]
}

export interface GitOpsSetupFailedEvent {
  projectId: string
  errors: string[]
}
