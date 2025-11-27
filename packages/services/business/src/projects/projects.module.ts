import { QueueModule } from '@juanie/core/queue'
import { AuditLogsModule, NotificationsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DeploymentsModule } from '../deployments/deployments.module'
import { EnvironmentsModule } from '../environments/environments.module'
import { RepositoriesModule } from '../repositories/repositories.module'
import { ProjectInitializationModule } from './initialization'
import { ProjectInitializationService } from './project-initialization.service'
import { ProjectMembersService } from './project-members.service'
import { ProjectOrchestrator } from './project-orchestrator.service'
import { ProjectStatusService } from './project-status.service'
import { ProjectsService } from './projects.service'
import { TemplatesModule } from './templates'

/**
 * Projects Module
 *
 * 注意：以下模块是全局模块，无需显式导入：
 * - AuthModule, FluxModule, K3sModule, GitProvidersModule
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    EnvironmentsModule,
    RepositoriesModule,
    DeploymentsModule,
    AuditLogsModule,
    NotificationsModule,
    TemplatesModule,
    ProjectInitializationModule,
  ],
  providers: [
    ProjectsService,
    ProjectOrchestrator,
    ProjectMembersService,
    ProjectStatusService,
    ProjectInitializationService,
  ],
  exports: [
    ProjectsService,
    ProjectOrchestrator,
    ProjectMembersService,
    ProjectStatusService,
    ProjectInitializationService,
    // 重新导出模板服务
    TemplatesModule,
  ],
})
export class ProjectsModule {}
