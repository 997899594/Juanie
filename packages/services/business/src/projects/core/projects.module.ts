import {
  AuditLogsModule,
  NotificationsModule,
  OrganizationsModule,
  RbacModule,
} from '@juanie/service-foundation'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DeploymentsModule } from '../../deployments/deployments.module'
import { EnvironmentsModule } from '../../environments/environments.module'
import { RepositoriesModule } from '../../repositories/repositories.module'
import { ProjectCleanupService } from '../cleanup'
import { ProjectInitializationModule } from '../initialization'
import { ProjectMembersModule } from '../members'
import { ProjectStatusService } from '../status'
import { TemplatesModule } from '../templates'
import { ProjectsService } from './projects.service'

/**
 * Projects Module（重构版 v2）
 *
 * 职责清晰的模块结构：
 * - ProjectsService: 项目 CRUD（~300 行）
 * - ProjectMembersService: 成员管理（已存在）
 * - ProjectStatusService: 状态管理（已存在）
 * - ProjectCleanupService: 定时清理（已存在）
 *
 * 架构原则：
 * 1. ✅ 显式导入 Foundation 层服务（OrganizationsModule, RbacModule）
 * 2. ✅ ProjectsService 注入 RbacService（仅用于 list 方法的 visibility 过滤）
 * 3. ❌ 不创建 ProjectAccessService（权限检查在 Router 层用 withAbility）
 * 4. ✅ 使用 @nestjs/bullmq 注册队列
 * 5. ✅ Core 层的 QueueModule 是全局的，无需导入
 *
 * 参考文档：
 * - docs/architecture/PROJECTS-SERVICE-DEEP-ANALYSIS.md
 * - docs/architecture/PERMISSION-CONTROL-ARCHITECTURE.md
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuditLogsModule,
    OrganizationsModule, // ✅ 显式导入（ProjectsService 需要）
    RbacModule, // ✅ 显式导入（ProjectsService.list() 需要）
    EnvironmentsModule,
    RepositoriesModule,
    DeploymentsModule,
    NotificationsModule,
    TemplatesModule,
    ProjectInitializationModule,
    ProjectMembersModule,
    // ✅ 注册 project-initialization 队列
    BullModule.registerQueue({
      name: 'project-initialization',
    }),
  ],
  providers: [ProjectsService, ProjectStatusService, ProjectCleanupService],
  exports: [
    ProjectsService,
    ProjectStatusService,
    // 重新导出模块
    TemplatesModule,
    RepositoriesModule, // 导出以便其他模块使用（包含 GitConnectionsModule）
    ProjectInitializationModule, // 导出以便其他模块访问初始化服务
    ProjectMembersModule, // 导出以便其他模块使用
  ],
})
export class ProjectsModule {}
