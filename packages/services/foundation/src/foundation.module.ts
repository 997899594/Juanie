import { Module } from '@nestjs/common'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { AuthModule } from './auth/auth.module'
import { GitAccountsModule } from './git-accounts/git-accounts.module'
import { NotificationsModule } from './notifications/notifications.module'
import { OrganizationsModule } from './organizations/organizations.module'
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
    GitAccountsModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    StorageModule,
    AuditLogsModule,
    NotificationsModule,
    GitAccountsModule,
  ],
})
export class FoundationModule {}
