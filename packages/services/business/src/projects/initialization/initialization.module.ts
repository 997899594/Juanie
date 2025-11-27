import { AuditLogsModule, NotificationsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { EnvironmentsModule } from '../../environments/environments.module'
import { RepositoriesModule } from '../../repositories/repositories.module'
import { TemplatesModule } from '../templates'
import { CreateEnvironmentsHandler } from './handlers/create-environments.handler'
import { CreateProjectHandler } from './handlers/create-project.handler'
import { FinalizeHandler } from './handlers/finalize.handler'
import { LoadTemplateHandler } from './handlers/load-template.handler'
import { RenderTemplateHandler } from './handlers/render-template.handler'
import { SetupRepositoryHandler } from './handlers/setup-repository.handler'
import { ProjectInitializationStateMachine } from './state-machine'

/**
 * Project Initialization Module
 *
 * 注意：AuthModule 和 FluxModule 是全局模块，无需显式导入
 */
@Module({
  imports: [
    TemplatesModule,
    EnvironmentsModule,
    RepositoriesModule,
    NotificationsModule,
    AuditLogsModule,
  ],
  providers: [
    // 状态机
    ProjectInitializationStateMachine,
    // 处理器
    CreateProjectHandler,
    LoadTemplateHandler,
    RenderTemplateHandler,
    CreateEnvironmentsHandler,
    SetupRepositoryHandler,
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
    FinalizeHandler,
  ],
})
export class ProjectInitializationModule {}
