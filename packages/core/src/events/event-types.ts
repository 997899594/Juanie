/**
 * 统一事件系统 - 类型定义
 *
 * 事件分层规范:
 * 1. 领域事件 (Domain Events) - 使用 NestJS EventEmitter
 *    - 同步处理，应用内部
 *    - 例如: project.created, user.updated
 *
 * 2. 集成事件 (Integration Events) - 使用 BullMQ
 *    - 异步处理，需要持久化和重试
 *    - 例如: deployment.queued, gitops.sync.requested
 *
 * 3. 实时事件 (Realtime Events) - 使用 Redis Pub/Sub
 *    - 推送到前端，不需要持久化
 *    - 例如: progress.updated, status.changed
 *
 * 事件命名规范: <domain>.<action>.<status>
 */

/**
 * 事件数据基类
 */
export interface BaseEvent<T = unknown> {
  /** 事件 ID */
  id: string
  /** 事件类型 */
  type: string
  /** 事件版本 */
  version: number
  /** 时间戳 (Unix timestamp in ms) */
  timestamp: number
  /** 关联的资源 ID */
  resourceId: string
  /** 触发用户 ID */
  userId?: string
  /** 事件数据 */
  data: T
}

// ==================== 领域事件 (Domain Events) ====================

/**
 * 领域事件 - 使用 NestJS EventEmitter (同步)
 */
export const DomainEvents = {
  // 项目事件
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_MEMBER_ADDED: 'project.member.added',
  PROJECT_MEMBER_UPDATED: 'project.member.updated',
  PROJECT_MEMBER_REMOVED: 'project.member.removed',

  // 用户事件
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  // 组织事件
  ORGANIZATION_CREATED: 'organization.created',
  ORGANIZATION_UPDATED: 'organization.updated',
  ORGANIZATION_MEMBER_ADDED: 'organization.member.added',
  ORGANIZATION_MEMBER_REMOVED: 'organization.member.removed',
  ORGANIZATION_MEMBER_ROLE_UPDATED: 'organization.member.role.updated',

  // 环境事件
  ENVIRONMENT_CREATED: 'environment.created',
  ENVIRONMENT_UPDATED: 'environment.updated',
  ENVIRONMENT_DELETED: 'environment.deleted',

  // Git 平台事件 (来自 Webhook)
  GIT_REPOSITORY_CHANGED: 'git.repository.changed',
  GIT_COLLABORATOR_CHANGED: 'git.collaborator.changed',
  GIT_MEMBER_CHANGED: 'git.member.changed',
  GIT_ORGANIZATION_CHANGED: 'git.organization.changed',
  GIT_PUSH: 'git.push',
} as const

export type DomainEventType = (typeof DomainEvents)[keyof typeof DomainEvents]

// 项目事件数据
export interface ProjectCreatedEventData {
  projectId: string
  name: string
  organizationId: string
  createdBy: string
}

export interface ProjectCreatedEvent extends BaseEvent<ProjectCreatedEventData> {
  type: typeof DomainEvents.PROJECT_CREATED
  version: 1
}

export interface ProjectUpdatedEventData {
  projectId: string
  changes: Record<string, unknown>
  updatedBy: string
}

export interface ProjectUpdatedEvent extends BaseEvent<ProjectUpdatedEventData> {
  type: typeof DomainEvents.PROJECT_UPDATED
  version: 1
}

// ==================== 集成事件 (Integration Events) ====================

/**
 * 集成事件 - 使用 BullMQ (异步，持久化)
 */
export const IntegrationEvents = {
  // 项目初始化事件
  INIT_QUEUED: 'project.init.queued',
  INIT_STARTED: 'project.init.started',
  INIT_STEP_COMPLETED: 'project.init.step_completed',
  INIT_COMPLETED: 'project.init.completed',
  INIT_FAILED: 'project.init.failed',

  // GitOps 事件
  GITOPS_SETUP_REQUESTED: 'gitops.setup.requested',
  GITOPS_SETUP_STARTED: 'gitops.setup.started',
  GITOPS_SETUP_COMPLETED: 'gitops.setup.completed',
  GITOPS_SETUP_FAILED: 'gitops.setup.failed',

  // 部署事件
  DEPLOYMENT_QUEUED: 'deployment.queued',
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',

  // Git 同步事件
  GIT_SYNC_QUEUED: 'git.sync.queued',
  GIT_SYNC_COMPLETED: 'git.sync.completed',
  GIT_SYNC_FAILED: 'git.sync.failed',
} as const

export type IntegrationEventType = (typeof IntegrationEvents)[keyof typeof IntegrationEvents]

// GitOps 设置请求事件
export interface GitOpsSetupRequestedEventData {
  projectId: string
  repositoryId: string
  repositoryUrl: string
  repositoryBranch: string
  userId: string
  environments: Array<{
    id: string
    type: 'development' | 'staging' | 'production'
    name: string
  }>
  jobId?: string
}

export interface GitOpsSetupRequestedEvent extends BaseEvent<GitOpsSetupRequestedEventData> {
  type: typeof IntegrationEvents.GITOPS_SETUP_REQUESTED
  version: 1
}

// GitOps 设置完成事件
export interface GitOpsSetupCompletedEventData {
  projectId: string
  namespaces: string[]
  gitRepositories: string[]
  kustomizations: string[]
}

export interface GitOpsSetupCompletedEvent extends BaseEvent<GitOpsSetupCompletedEventData> {
  type: typeof IntegrationEvents.GITOPS_SETUP_COMPLETED
  version: 1
}

// GitOps 设置失败事件
export interface GitOpsSetupFailedEventData {
  projectId: string
  errors: string[]
}

export interface GitOpsSetupFailedEvent extends BaseEvent<GitOpsSetupFailedEventData> {
  type: typeof IntegrationEvents.GITOPS_SETUP_FAILED
  version: 1
}

// ==================== 实时事件 (Realtime Events) ====================

/**
 * 实时事件 - 使用 Redis Pub/Sub (推送到前端)
 */
export const RealtimeEvents = {
  // 进度事件
  PROGRESS_UPDATED: 'progress.updated',
  PROGRESS_COMPLETED: 'progress.completed',

  // 状态变更事件
  STATUS_CHANGED: 'status.changed',

  // 通知事件
  NOTIFICATION_SENT: 'notification.sent',

  // 资源健康事件
  HEALTH_CHANGED: 'health.changed',
} as const

export type RealtimeEventType = (typeof RealtimeEvents)[keyof typeof RealtimeEvents]

// 进度更新事件
export interface ProgressUpdatedEventData {
  projectId: string
  step: string
  progress: number
  message: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface ProgressUpdatedEvent extends BaseEvent<ProgressUpdatedEventData> {
  type: typeof RealtimeEvents.PROGRESS_UPDATED
  version: 1
}

// 状态变更事件
export interface StatusChangedEventData {
  resourceType: 'project' | 'deployment' | 'environment'
  resourceId: string
  oldStatus: string
  newStatus: string
  reason?: string
}

export interface StatusChangedEvent extends BaseEvent<StatusChangedEventData> {
  type: typeof RealtimeEvents.STATUS_CHANGED
  version: 1
}

// ==================== 系统事件 (System Events) ====================

/**
 * 系统事件 - 使用 NestJS EventEmitter (同步)
 */
export const SystemEvents = {
  // 应用生命周期
  BOOTSTRAP_COMPLETE: 'system.bootstrap.complete',
  ALL_SERVICES_READY: 'system.all.services.ready',
  SHUTDOWN_INITIATED: 'system.shutdown.initiated',

  // K3s 连接事件
  K3S_CONNECTED: 'k3s.connected',
  K3S_DISCONNECTED: 'k3s.disconnected',
  K3S_CONNECTION_FAILED: 'k3s.connection.failed',

  // Flux 事件
  FLUX_INSTALLED: 'flux.installed',
  FLUX_NOT_INSTALLED: 'flux.not.installed',
  FLUX_HEALTH_CHECKED: 'flux.health.checked',
} as const

export type SystemEventType = (typeof SystemEvents)[keyof typeof SystemEvents]

// K3s 连接事件
export interface K3sConnectedEventData {
  kubeconfigPath?: string
}

export interface K3sConnectedEvent extends BaseEvent<K3sConnectedEventData> {
  type: typeof SystemEvents.K3S_CONNECTED
  version: 1
}

export interface K3sConnectionFailedEventData {
  error: string
  kubeconfigPath?: string
}

export interface K3sConnectionFailedEvent extends BaseEvent<K3sConnectionFailedEventData> {
  type: typeof SystemEvents.K3S_CONNECTION_FAILED
  version: 1
}

// Flux 健康检查事件
export interface FluxHealthCheckedEventData {
  installed: boolean
  healthy?: boolean
}

export interface FluxHealthCheckedEvent extends BaseEvent<FluxHealthCheckedEventData> {
  type: typeof SystemEvents.FLUX_HEALTH_CHECKED
  version: 1
}

// ==================== 事件类型联合 ====================

/**
 * 所有事件类型
 */
export type AnyEvent =
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | GitOpsSetupRequestedEvent
  | GitOpsSetupCompletedEvent
  | GitOpsSetupFailedEvent
  | ProgressUpdatedEvent
  | StatusChangedEvent
  | K3sConnectedEvent
  | K3sConnectionFailedEvent
  | FluxHealthCheckedEvent

/**
 * 所有事件类型字符串
 */
export type EventType = DomainEventType | IntegrationEventType | RealtimeEventType | SystemEventType

// ==================== 向后兼容的导出 (临时) ====================

/**
 * @deprecated 使用 SystemEvents.K3S_CONNECTED 代替
 */
export const K3sEvents = {
  CONNECTED: SystemEvents.K3S_CONNECTED,
  CONNECTION_FAILED: SystemEvents.K3S_CONNECTION_FAILED,
  DISCONNECTED: SystemEvents.K3S_DISCONNECTED,
} as const

/**
 * @deprecated 使用 SystemEvents.FLUX_* 代替
 */
export const FluxEvents = {
  INSTALLED: SystemEvents.FLUX_INSTALLED,
  NOT_INSTALLED: SystemEvents.FLUX_NOT_INSTALLED,
  HEALTH_CHECKED: SystemEvents.FLUX_HEALTH_CHECKED,
} as const

/**
 * @deprecated 使用 DomainEvents.PROJECT_* 代替
 */
export const ProjectEvents = {
  CREATION_STARTED: 'project.creation.started',
  CREATION_COMPLETED: DomainEvents.PROJECT_CREATED,
  CREATION_FAILED: 'project.creation.failed',
} as const

/**
 * @deprecated 使用 IntegrationEvents.GITOPS_* 代替
 */
export const GitOpsEvents = {
  SETUP_REQUESTED: IntegrationEvents.GITOPS_SETUP_REQUESTED,
  SETUP_STARTED: IntegrationEvents.GITOPS_SETUP_STARTED,
  SETUP_COMPLETED: IntegrationEvents.GITOPS_SETUP_COMPLETED,
  SETUP_FAILED: IntegrationEvents.GITOPS_SETUP_FAILED,
} as const
