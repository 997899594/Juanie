import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { TeamsModule } from './teams/teams.module'
import { StorageModule } from './storage/storage.module'

/**
 * Foundation Module - 基础层模块
 * 提供认证、用户管理、组织管理、团队管理和存储功能
 */
@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule, TeamsModule, StorageModule],
  exports: [AuthModule, UsersModule, OrganizationsModule, TeamsModule, StorageModule],
})
export class FoundationModule {}
