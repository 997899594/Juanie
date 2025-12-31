import { Module } from '@nestjs/common'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { AuthModule } from './auth/auth.module'
import { GitConnectionsModule } from './git-connections/git-connections.module'
import { GitProvidersModule } from './git-providers/git-providers.module'
import { GitSyncLogsModule } from './git-sync-logs/git-sync-logs.module'
import { GitOpsResourcesModule } from './gitops-resources/gitops-resources.module'
import { NotificationsModule } from './notifications/notifications.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { RateLimitModule } from './rate-limit/rate-limit.module'
import { RbacModule } from './rbac/rbac.module'
import { SessionsModule } from './sessions/sessions.module'
import { StorageModule } from './storage/storage.module'
import { TeamsModule } from './teams/teams.module'
import { UsersModule } from './users/users.module'

/**
 * Foundation Module - 基础层模块
 * 提供认证、用户管理、组织管理、团队管理、RBAC、审计日志和通知功能
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    RbacModule, // RBAC 权限系统
    AuditLogsModule,
    NotificationsModule,
    GitConnectionsModule,
    GitProvidersModule, // Git Providers (GitHub/GitLab API)
    GitSyncLogsModule,
    GitOpsResourcesModule, // GitOps Resources
    RateLimitModule,
    SessionsModule,
    StorageModule, // 存储服务
  ],
  exports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    RbacModule, // 导出 RBAC 供其他模块使用
    AuditLogsModule,
    NotificationsModule,
    GitConnectionsModule,
    GitProvidersModule, // 导出 Git Providers 供 Business 层使用
    GitSyncLogsModule,
    GitOpsResourcesModule, // 导出 GitOps Resources
    RateLimitModule,
    SessionsModule,
    StorageModule, // 导出存储服务
  ],
})
export class FoundationModule {}
