import { QueueModule as CoreQueueModule } from '@juanie/core/queue'
import { AuthModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ProgressManagerService } from '../projects/initialization/progress-manager.service'
import { ProjectsModule } from '../projects/projects.module'
import { ProjectInitializationWorker } from './project-initialization.worker'

/**
 * Business Queue Module
 *
 * 包含业务相关的 Workers
 * 这些 Workers 包含具体的业务逻辑，所以放在 business 包中
 *
 * 注意：GitConnectionsModule 通过 ProjectsModule → RepositoriesModule 传递
 */
@Module({
  imports: [
    CoreQueueModule, // 导入基础的 Queue 模块
    ConfigModule,
    AuthModule,
    ProjectsModule, // 提供 ProjectInitializationService，包含 RepositoriesModule（含 GitConnectionsModule）
  ],
  providers: [
    ProgressManagerService, // 直接提供 ProgressManagerService
    ProjectInitializationWorker,
  ],
  exports: [ProjectInitializationWorker],
})
export class BusinessQueueModule {}
