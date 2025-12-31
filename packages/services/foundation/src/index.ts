// Foundation Layer - 基础层服务
// 提供认证、用户管理、组织管理、团队管理、审计日志、通知和存储功能

// 类型导出（从 @juanie/types 统一管理）
export type * from '@juanie/types'
// 审计日志
export { AuditLogsModule } from './audit-logs/audit-logs.module'
export { AuditLogsService } from './audit-logs/audit-logs.service'
// 认证服务
export { AuthModule } from './auth/auth.module'
export { AuthService } from './auth/auth.service'
// Foundation 层特有的错误类（不包括 Core 层的基础错误）
export {
  CannotRemoveOwnerError,
  EncryptionKeyMissingError,
  GitConnectionInvalidError,
  GitConnectionNotFoundError,
  InvalidStateError,
  NotificationNotFoundError,
  NotOrganizationMemberError,
  NotTeamMemberError,
  OAuthError,
  OrganizationMemberAlreadyExistsError,
  OrganizationNotFoundError,
  PermissionDeniedError,
  TeamMemberAlreadyExistsError,
  TeamMemberNotFoundError,
  TeamNotFoundError,
  TokenDecryptionError,
  TokenRefreshError,
} from './errors'
// 模块导出
export { FoundationModule } from './foundation.module'
// Git 连接服务
export { GitConnectionsModule } from './git-connections/git-connections.module'
export { GitConnectionsService } from './git-connections/git-connections.service'
export type { CreateRepositoryOptions, RepositoryInfo } from './git-providers/git-provider.service'
export { GitProviderService } from './git-providers/git-provider.service'
// Git Providers 服务（GitHub/GitLab API 封装）
export { GitProvidersModule } from './git-providers/git-providers.module'
export { GitHubClientService } from './git-providers/github-client.service'
export { GitLabClientService } from './git-providers/gitlab-client.service'
// Git 同步日志服务
export { GitSyncLogsModule } from './git-sync-logs/git-sync-logs.module'
export type {
  CreateGitSyncLogDto,
  UpdateGitSyncLogDto,
} from './git-sync-logs/git-sync-logs.service'
export { GitSyncLogsService } from './git-sync-logs/git-sync-logs.service'
// GitOps Resources 服务
export { GitOpsResourcesModule } from './gitops-resources/gitops-resources.module'
export { GitOpsResourcesService } from './gitops-resources/gitops-resources.service'
// 通知服务
export { NotificationsModule } from './notifications/notifications.module'
export { NotificationsService } from './notifications/notifications.service'
export {
  type OrganizationCreatedEvent,
  OrganizationEventsService,
  type OrganizationMemberAddedEvent,
  type OrganizationMemberRemovedEvent,
  type OrganizationMemberRoleUpdatedEvent,
} from './organizations/organization-events.service'
// 组织服务
export { OrganizationsModule } from './organizations/organizations.module'
export { OrganizationsService } from './organizations/organizations.service'
// 速率限制服务
export { RateLimitModule } from './rate-limit/rate-limit.module'
export { RateLimitService } from './rate-limit/rate-limit.service'
// RBAC 服务
export * from './rbac'
// 会话服务
export { SessionService } from './sessions/session.service'
export { SessionsModule } from './sessions/sessions.module'
// 存储服务
export { StorageModule } from './storage/storage.module'
export { StorageError, StorageService } from './storage/storage.service'
// 团队服务
export { TeamsModule } from './teams/teams.module'
export { TeamsService } from './teams/teams.service'
// 用户服务
export { UsersModule } from './users/users.module'
export { UsersService } from './users/users.service'
