import { AuditLogsModule, NotificationsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EnvironmentsModule } from '../../environments/environments.module'
import { RepositoriesModule } from '../../repositories/repositories.module'
import { TemplatesModule } from '../templates'
import { CreateEnvironmentsHandler } from './handlers/create-environments.handler'
import { CreateProjectHandler } from './handlers/create-project.handler'
import { FinalizeHandler } from './handlers/finalize.handler'
import { LoadTemplateHandler } from './handlers/load-template.handler'
import { RenderTemplateHandler } from './handlers/render-template.handler'
import { SetupRepositoryHandler } from './handlers/setup-repository.handler'
import { InitializationStepsService } from './initialization-steps.service'
import { ProgressManagerService } from './progress-manager.service'
import { ProjectInitializationStateMachine } from './state-machine'

/**
 * Project Initialization Module
 *
 * 注意：
 * - AuthModule 和 FluxModule 是全局模块，无需显式导入
 * - GitConnectionsModule 通过 RepositoriesModule 重新导出，无需直接导入
 */
@Module({
  imports: [
    ConfigModule,
    TemplatesModule,
    EnvironmentsModule,
    RepositoriesModule, // 包含 GitConnectionsModule
    NotificationsModule,
    AuditLogsModule,
  ],
  providers: [
    // 进度管理器
    ProgressManagerService,
    // 步骤管理服务
    InitializationStepsService,
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
    // 导出进度管理器
    ProgressManagerService,
    // 导出步骤管理服务
    InitializationStepsService,
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
