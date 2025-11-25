/**
 * Events 相关类型定义
 * 用于事件驱动架构的模块间通信
 */

import type { ProjectHealth } from './project.types'

// ============================================
// 基础事件类型
// ============================================

/**
 * 基础事件接口
 */
export interface BaseEvent {
  type: string
  timestamp: Date
  metadata?: Record<string, any>
}

// ============================================
// 项目事件
// ============================================

/**
 * 项目创建事件
 */
export interface ProjectCreatedEvent extends BaseEvent {
  type: 'project.created'
  projectId: string
  organizationId: string
  templateId?: string
  createdBy: string
}

/**
 * 项目初始化事件
 */
export interface ProjectInitializedEvent extends BaseEvent {
  type: 'project.initialized'
  projectId: string
  createdResources: {
    environments: string[]
    repositories: string[]
    gitopsResources: string[]
  }
}

/**
 * 项目初始化失败事件
 */
export interface ProjectInitializationFailedEvent extends BaseEvent {
  type: 'project.initialization.failed'
  projectId: string
  step: string
  error: string
  completedSteps: string[]
}

/**
 * 项目更新事件
 */
export interface ProjectUpdatedEvent extends BaseEvent {
  type: 'project.updated'
  projectId: string
  updatedFields: string[]
  updatedBy: string
}

/**
 * 项目归档事件
 */
export interface ProjectArchivedEvent extends BaseEvent {
  type: 'project.archived'
  projectId: string
  reason?: string
  archivedBy: string
}

/**
 * 项目恢复事件
 */
export interface ProjectRestoredEvent extends BaseEvent {
  type: 'project.restored'
  projectId: string
  restoredBy: string
}

/**
 * 项目删除事件
 */
export interface ProjectDeletedEvent extends BaseEvent {
  type: 'project.deleted'
  projectId: string
  deletedBy: string
}

/**
 * 项目健康度变化事件
 */
export interface ProjectHealthChangedEvent extends BaseEvent {
  type: 'project.health.changed'
  projectId: string
  previousHealth: ProjectHealth
  currentHealth: ProjectHealth
}

/**
 * 项目配置变更事件
 */
export interface ProjectConfigChangedEvent extends BaseEvent {
  type: 'project.config.changed'
  projectId: string
  previousConfig: Record<string, any>
  currentConfig: Record<string, any>
  changedBy: string
}

/**
 * 项目事件联合类型
 */
export type ProjectEvent =
  | ProjectCreatedEvent
  | ProjectInitializedEvent
  | ProjectInitializationFailedEvent
  | ProjectUpdatedEvent
  | ProjectArchivedEvent
  | ProjectRestoredEvent
  | ProjectDeletedEvent
  | ProjectHealthChangedEvent
  | ProjectConfigChangedEvent

// ============================================
// 部署事件
// ============================================

/**
 * 部署创建事件
 */
export interface DeploymentCreatedEvent extends BaseEvent {
  type: 'deployment.created'
  deploymentId: string
  projectId: string
  environmentId: string
  version: string
  commitHash: string
  branch: string
  createdBy: string
}

/**
 * 部署开始事件
 */
export interface DeploymentStartedEvent extends BaseEvent {
  type: 'deployment.started'
  deploymentId: string
  projectId: string
  environmentId: string
  strategy?: 'rolling' | 'blue_green' | 'canary'
}

/**
 * 部署完成事件
 */
export interface DeploymentCompletedEvent extends BaseEvent {
  type: 'deployment.completed'
  deploymentId: string
  projectId: string
  environmentId: string
  status: 'success' | 'failed'
  duration?: number
  errorMessage?: string
}

/**
 * 部署失败事件
 */
export interface DeploymentFailedEvent extends BaseEvent {
  type: 'deployment.failed'
  deploymentId: string
  projectId: string
  environmentId: string
  error: string
  failedStep?: string
}

/**
 * 部署回滚事件
 */
export interface DeploymentRolledBackEvent extends BaseEvent {
  type: 'deployment.rolled_back'
  deploymentId: string
  projectId: string
  environmentId: string
  targetDeploymentId: string
  rolledBackBy: string
}

/**
 * 部署审批请求事件
 */
export interface DeploymentApprovalRequestedEvent extends BaseEvent {
  type: 'deployment.approval.requested'
  deploymentId: string
  projectId: string
  environmentId: string
  approvers: string[]
  requestedBy: string
}

/**
 * 部署审批完成事件
 */
export interface DeploymentApprovedEvent extends BaseEvent {
  type: 'deployment.approved'
  deploymentId: string
  projectId: string
  environmentId: string
  approvalId: string
  approvedBy: string
  comment?: string
}

/**
 * 部署审批拒绝事件
 */
export interface DeploymentRejectedEvent extends BaseEvent {
  type: 'deployment.rejected'
  deploymentId: string
  projectId: string
  environmentId: string
  approvalId: string
  rejectedBy: string
  reason: string
}

/**
 * 部署审批超时事件
 */
export interface DeploymentApprovalTimeoutEvent extends BaseEvent {
  type: 'deployment.approval.timeout'
  deploymentId: string
  projectId: string
  environmentId: string
  approvalId: string
  timeoutDuration: number
}

/**
 * 部署事件联合类型
 */
export type DeploymentEvent =
  | DeploymentCreatedEvent
  | DeploymentStartedEvent
  | DeploymentCompletedEvent
  | DeploymentFailedEvent
  | DeploymentRolledBackEvent
  | DeploymentApprovalRequestedEvent
  | DeploymentApprovedEvent
  | DeploymentRejectedEvent
  | DeploymentApprovalTimeoutEvent

// ============================================
// GitOps 事件
// ============================================

/**
 * GitOps 资源创建事件
 */
export interface GitOpsResourceCreatedEvent extends BaseEvent {
  type: 'gitops.resource.created'
  resourceId: string
  projectId: string
  environmentId: string
  resourceType: 'kustomization' | 'helm'
  name: string
  namespace: string
}

/**
 * GitOps 同步状态事件
 */
export interface GitOpsSyncStatusEvent extends BaseEvent {
  type: 'gitops.sync.status'
  resourceId: string
  projectId: string
  environmentId: string
  status: 'ready' | 'reconciling' | 'failed' | 'unknown'
  errorMessage?: string
  revision?: string
}

/**
 * GitOps 同步成功事件
 */
export interface GitOpsSyncSuccessEvent extends BaseEvent {
  type: 'gitops.sync.success'
  resourceId: string
  projectId: string
  environmentId: string
  revision: string
  duration?: number
}

/**
 * GitOps 同步失败事件
 */
export interface GitOpsSyncFailedEvent extends BaseEvent {
  type: 'gitops.sync.failed'
  resourceId: string
  projectId: string
  environmentId: string
  error: string
  retryCount?: number
}

/**
 * GitOps 资源删除事件
 */
export interface GitOpsResourceDeletedEvent extends BaseEvent {
  type: 'gitops.resource.deleted'
  resourceId: string
  projectId: string
  environmentId: string
  deletedBy: string
}

/**
 * GitOps 配置变更事件
 */
export interface GitOpsConfigChangedEvent extends BaseEvent {
  type: 'gitops.config.changed'
  resourceId: string
  projectId: string
  environmentId: string
  previousConfig: Record<string, any>
  currentConfig: Record<string, any>
  changedBy: string
}

/**
 * GitOps 事件联合类型
 */
export type GitOpsEvent =
  | GitOpsResourceCreatedEvent
  | GitOpsSyncStatusEvent
  | GitOpsSyncSuccessEvent
  | GitOpsSyncFailedEvent
  | GitOpsResourceDeletedEvent
  | GitOpsConfigChangedEvent

// ============================================
// 环境事件
// ============================================

/**
 * 环境创建事件
 */
export interface EnvironmentCreatedEvent extends BaseEvent {
  type: 'environment.created'
  environmentId: string
  projectId: string
  name: string
  environmentType: 'development' | 'staging' | 'production' | 'testing'
  createdBy: string
}

/**
 * 环境更新事件
 */
export interface EnvironmentUpdatedEvent extends BaseEvent {
  type: 'environment.updated'
  environmentId: string
  projectId: string
  updatedFields: string[]
  updatedBy: string
}

/**
 * 环境删除事件
 */
export interface EnvironmentDeletedEvent extends BaseEvent {
  type: 'environment.deleted'
  environmentId: string
  projectId: string
  deletedBy: string
}

/**
 * 环境配置变更事件
 */
export interface EnvironmentConfigChangedEvent extends BaseEvent {
  type: 'environment.config.changed'
  environmentId: string
  projectId: string
  previousConfig: Record<string, any>
  currentConfig: Record<string, any>
  changedBy: string
}

/**
 * 环境事件联合类型
 */
export type EnvironmentEvent =
  | EnvironmentCreatedEvent
  | EnvironmentUpdatedEvent
  | EnvironmentDeletedEvent
  | EnvironmentConfigChangedEvent

// ============================================
// 仓库事件
// ============================================

/**
 * 仓库连接事件
 */
export interface RepositoryConnectedEvent extends BaseEvent {
  type: 'repository.connected'
  repositoryId: string
  projectId: string
  provider: 'github' | 'gitlab'
  fullName: string
  connectedBy: string
}

/**
 * 仓库同步事件
 */
export interface RepositorySyncedEvent extends BaseEvent {
  type: 'repository.synced'
  repositoryId: string
  projectId: string
  syncStatus: 'success' | 'failed'
  errorMessage?: string
}

/**
 * 仓库断开连接事件
 */
export interface RepositoryDisconnectedEvent extends BaseEvent {
  type: 'repository.disconnected'
  repositoryId: string
  projectId: string
  disconnectedBy: string
}

/**
 * 仓库事件联合类型
 */
export type RepositoryEvent =
  | RepositoryConnectedEvent
  | RepositorySyncedEvent
  | RepositoryDisconnectedEvent

// ============================================
// 通知事件
// ============================================

/**
 * 通知发送事件
 */
export interface NotificationSentEvent extends BaseEvent {
  type: 'notification.sent'
  notificationId: string
  userId: string
  notificationType: 'deployment' | 'approval' | 'cost_alert' | 'security' | 'system'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  channel: 'email' | 'in_app' | 'slack' | 'webhook'
}

/**
 * 告警触发事件
 */
export interface AlertTriggeredEvent extends BaseEvent {
  type: 'alert.triggered'
  alertId: string
  projectId?: string
  organizationId?: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  source: string
}

/**
 * 通知事件联合类型
 */
export type NotificationEvent = NotificationSentEvent | AlertTriggeredEvent

// ============================================
// 所有事件联合类型
// ============================================

/**
 * 系统所有事件的联合类型
 */
export type SystemEvent =
  | ProjectEvent
  | DeploymentEvent
  | GitOpsEvent
  | EnvironmentEvent
  | RepositoryEvent
  | NotificationEvent

// ============================================
// 事件处理器类型
// ============================================

/**
 * 事件处理器函数类型
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void> | void

/**
 * 事件订阅配置
 */
export interface EventSubscription {
  eventType: string
  handler: EventHandler
  priority?: number
  filter?: (event: BaseEvent) => boolean
}

/**
 * 事件发布选项
 */
export interface PublishOptions {
  delay?: number // 延迟发布（毫秒）
  retry?: {
    maxAttempts: number
    backoff: 'linear' | 'exponential'
  }
  persistent?: boolean // 是否持久化到数据库
}

/**
 * 事件查询条件
 */
export interface EventQuery {
  projectId?: string
  eventType?: string | string[]
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * 事件统计
 */
export interface EventStats {
  eventType: string
  count: number
  lastOccurrence?: Date
}
