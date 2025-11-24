import { QueueModule } from '@juanie/core/queue'
import { AuditLogsModule, NotificationsModule } from '@juanie/service-extensions'
import { AuthModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DeploymentsModule } from '../deployments/deployments.module'
import { EnvironmentsModule } from '../environments/environments.module'
import { FluxModule } from '../gitops/flux/flux.module'
import { GitProvidersModule } from '../gitops/git-providers/git-providers.module'
import { K3sModule } from '../gitops/k3s/k3s.module'
import { RepositoriesModule } from '../repositories/repositories.module'
import { ProjectInitializationModule } from './initialization'
import { ProjectInitializationService } from './project-initialization.service'
import { ProjectMembersService } from './project-members.service'
import { ProjectOrchestrator } from './project-orchestrator.service'
import { ProjectStatusService } from './project-status.service'
import { ProjectsService } from './projects.service'
import { TemplatesModule } from './templates'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    AuthModule,
    EnvironmentsModule,
    RepositoriesModule,
    FluxModule,
    GitProvidersModule,
    K3sModule,
    DeploymentsModule,
    AuditLogsModule,
    NotificationsModule,
    // 模板服务模块
    TemplatesModule,
    // 初始化模块
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
