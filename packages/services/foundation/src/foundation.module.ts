import { Module } from '@nestjs/common'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { AuthModule } from './auth/auth.module'
import { GitConnectionsModule } from './git-connections/git-connections.module'
import { NotificationsModule } from './notifications/notifications.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { RateLimitModule } from './rate-limit/rate-limit.module'
import { SessionsModule } from './sessions/sessions.module'
import { StorageModule } from './storage/storage.module'
import { TeamsModule } from './teams/teams.module'
import { UsersModule } from './users/users.module'

/**
 * Foundation Module - 基础层模块
 * 提供认证、用户管理、组织管理、团队管理、存储、审计日志和通知功能
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    StorageModule,
    AuditLogsModule,
    NotificationsModule,
    GitConnectionsModule,
    RateLimitModule,
    SessionsModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    StorageModule,
    AuditLogsModule,
    NotificationsModule,
    GitConnectionsModule,
    RateLimitModule,
    SessionsModule,
  ],
})
export class FoundationModule {}
