import { AuditLogsModule } from '@juanie/service-extensions'
import { AuthModule } from '@juanie/service-foundation'
import { EnvironmentsModule } from '../../environments/environments.module'
import { FluxModule } from '../../gitops/flux/flux.module'
import { NotificationsModule } from '@juanie/service-extensions'
import { RepositoriesModule } from '../../repositories/repositories.module'
import { Module } from '@nestjs/common'
import { TemplatesModule } from '../templates'
import { CreateEnvironmentsHandler } from './handlers/create-environments.handler'
import { CreateGitOpsHandler } from './handlers/create-gitops.handler'
import { CreateProjectHandler } from './handlers/create-project.handler'
import { FinalizeHandler } from './handlers/finalize.handler'
import { LoadTemplateHandler } from './handlers/load-template.handler'
import { RenderTemplateHandler } from './handlers/render-template.handler'
import { SetupRepositoryHandler } from './handlers/setup-repository.handler'
import { ProgressTrackerService } from './progress-tracker.service'
import { ProjectInitializationStateMachine } from './state-machine'

@Module({
  imports: [
    // 模板服务模块
    TemplatesModule,
    // 其他依赖
    EnvironmentsModule,
    RepositoriesModule,
    FluxModule,
    NotificationsModule,
    AuditLogsModule,
    AuthModule,
  ],
  providers: [
    // 状态机和进度追踪
    ProjectInitializationStateMachine,
    ProgressTrackerService,
    // 处理器
    CreateProjectHandler,
    LoadTemplateHandler,
    RenderTemplateHandler,
    CreateEnvironmentsHandler,
    SetupRepositoryHandler,
    CreateGitOpsHandler,
    FinalizeHandler,
  ],
  exports: [
    // 导出状态机
    ProjectInitializationStateMachine,
    // 导出所有处理器（供 ProjectOrchestrator 使用）
    CreateProjectHandler,
    LoadTemplateHandler,
    RenderTemplateHandler,
    CreateEnvironmentsHandler,
    SetupRepositoryHandler,
    CreateGitOpsHandler,
    FinalizeHandler,
  ],
})
export class ProjectInitializationModule {}
