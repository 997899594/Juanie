import { DatabaseModule } from '@juanie/core/database'
import { AuditLogsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ProjectMembersService } from './project-members.service'

/**
 * Project Members Module
 *
 * 提供项目成员管理功能
 * 使用事件驱动架构与 GitSyncService 解耦，无需直接依赖
 */
@Module({
  imports: [DatabaseModule, AuditLogsModule],
  providers: [ProjectMembersService],
  exports: [ProjectMembersService],
})
export class ProjectMembersModule {}
