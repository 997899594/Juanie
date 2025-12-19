// Foundation Layer - 基础层服务
// 提供认证、用户管理、组织管理、团队管理、存储、审计日志和通知功能

// 类型导出（从 @juanie/types 统一管理）
export type * from '@juanie/types'
// 审计日志
export { AuditLogsModule } from './audit-logs/audit-logs.module'
export { AuditLogsService } from './audit-logs/audit-logs.service'
// 认证服务
export { AuthModule } from './auth/auth.module'
export { AuthService } from './auth/auth.service'
// OAuthAccountsService 已被 GitConnectionsService 替代
// 加密服务
export { EncryptionModule } from './encryption/encryption.module'
export { EncryptionService } from './encryption/encryption.service'
// 模块导出
export { FoundationModule } from './foundation.module'
export { GitAccountLinkingService } from './git-accounts/git-account-linking.service'
// Git OAuth 服务
export { GitOAuthModule } from './git-accounts/git-accounts.module'
export { GitHubOAuthService } from './git-accounts/github-oauth.service'
export { GitLabOAuthService } from './git-accounts/gitlab-oauth.service'
// Git 连接服务（新）
export { GitConnectionsModule } from './git-connections/git-connections.module'
export { GitConnectionsService } from './git-connections/git-connections.service'
// 通知服务
export { NotificationsModule } from './notifications/notifications.module'
export { NotificationsService } from './notifications/notifications.service'
// 组织服务
export { OrganizationsModule } from './organizations/organizations.module'
export { OrganizationsService } from './organizations/organizations.service'
// 存储服务
export { StorageModule } from './storage/storage.module'
export { StorageService } from './storage/storage.service'
// 团队服务
export { TeamsModule } from './teams/teams.module'
export { TeamsService } from './teams/teams.service'
// 用户服务
export { UsersModule } from './users/users.module'
export { UsersService } from './users/users.service'
