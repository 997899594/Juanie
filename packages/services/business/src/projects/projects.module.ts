import { QueueModule } from '@juanie/core/queue'
import { AuditLogsModule, NotificationsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DeploymentsModule } from '../deployments/deployments.module'
import { EnvironmentsModule } from '../environments/environments.module'
import { RepositoriesModule } from '../repositories/repositories.module'
import { ProjectInitializationModule } from './initialization'
import { ProjectCleanupService } from './project-cleanup.service'
import { ProjectMembersModule } from './project-members.module'
import { ProjectOrchestrator } from './project-orchestrator.service'
import { ProjectStatusService } from './project-status.service'
import { ProjectsService } from './projects.service'
import { TemplatesModule } from './templates'

/**
 * Projects Module
 *
 * 注意：以下模块是全局模块，无需显式导入：
 * - AuthModule, FluxModule, K3sModule, GitProvidersModule, GitSyncModule
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    AuditLogsModule,
    EnvironmentsModule,
    RepositoriesModule,
    DeploymentsModule,
    NotificationsModule,
    TemplatesModule,
    ProjectInitializationModule,
    ProjectMembersModule,
  ],
  providers: [ProjectsService, ProjectOrchestrator, ProjectStatusService, ProjectCleanupService],
  exports: [
    ProjectsService,
    ProjectOrchestrator,
    ProjectStatusService,
    // 重新导出模块
    TemplatesModule,
    RepositoriesModule, // 导出以便其他模块使用（包含 GitConnectionsModule）
    ProjectInitializationModule, // 导出以便其他模块访问 ProgressManager
    ProjectMembersModule, // 导出以便其他模块使用
  ],
})
export class ProjectsModule {}
