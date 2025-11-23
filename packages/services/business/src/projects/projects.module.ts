import { QueueModule } from '@juanie/core-queue'
import { AuditLogsModule } from '@juanie/service-extensions'
import { AuthModule } from '@juanie/service-foundation'
import { DeploymentsModule } from '../deployments/deployments.module'
import { EnvironmentsModule } from '../environments/environments.module'
import { FluxModule } from '../gitops/flux/flux.module'
import { GitProvidersModule } from '../gitops/git-providers/git-providers.module'
import { K3sModule } from '../gitops/k3s/k3s.module'
import { NotificationsModule } from '@juanie/service-extensions'
import { RepositoriesModule } from '../repositories/repositories.module'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ApprovalManager } from './approval-manager.service'
import { HealthMonitorService } from './health-monitor.service'
import { ProjectInitializationModule } from './initialization'
import { OneClickDeployService } from './one-click-deploy.service'
import { ProjectOrchestrator } from './project-orchestrator.service'
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
    HealthMonitorService,
    ApprovalManager,
    OneClickDeployService,
  ],
  exports: [
    ProjectsService,
    ProjectOrchestrator,
    HealthMonitorService,
    ApprovalManager,
    OneClickDeployService,
    // 重新导出模板服务
    TemplatesModule,
  ],
})
export class ProjectsModule {}
