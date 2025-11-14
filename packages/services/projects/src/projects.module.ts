import { QueueModule } from '@juanie/core-queue'
import { AuditLogsModule } from '@juanie/service-audit-logs'
import { AuthModule } from '@juanie/service-auth'
import { DeploymentsModule } from '@juanie/service-deployments'
import { EnvironmentsModule } from '@juanie/service-environments'
import { FluxModule } from '@juanie/service-flux'
import { GitProvidersModule } from '@juanie/service-git-providers'
import { K3sModule } from '@juanie/service-k3s'
import { NotificationsModule } from '@juanie/service-notifications'
import { RepositoriesModule } from '@juanie/service-repositories'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ApprovalManager } from './approval-manager.service'
import { HealthMonitorService } from './health-monitor.service'
import { ProjectOrchestrator } from './project-orchestrator.service'
import { ProjectsService } from './projects.service'
import { TemplateManager } from './template-manager.service'

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
  ],
  providers: [
    ProjectsService,
    TemplateManager,
    ProjectOrchestrator,
    HealthMonitorService,
    ApprovalManager,
  ],
  exports: [
    ProjectsService,
    TemplateManager,
    ProjectOrchestrator,
    HealthMonitorService,
    ApprovalManager,
  ],
})
export class ProjectsModule {}
