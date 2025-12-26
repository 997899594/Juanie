import { AuthModule } from '@juanie/service-foundation'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ProjectsModule } from '../projects/core'
import { ProjectInitializationWorker } from './project-initialization.worker'

/**
 * Business Queue Module
 *
 * 包含业务相关的 Workers
 * 这些 Workers 包含具体的业务逻辑，所以放在 business 包中
 *
 * 使用 @nestjs/bullmq 的 BullModule 来注册 Worker
 *
 * 架构说明：
 * - Core 层提供全局 BullMQ 配置（BullModule.forRoot）- 自动可用，无需导入
 * - Business 层注册具体队列（BullModule.registerQueue）
 * - Worker 使用 @Processor 装饰器自动注册
 *
 * 注意：GitConnectionsModule 通过 ProjectsModule → RepositoriesModule 传递
 */
@Module({
  imports: [
    AuthModule,
    ProjectsModule, // 提供 ProjectInitializationService
    // 注册 project-initialization 队列
    BullModule.registerQueue({
      name: 'project-initialization',
    }),
  ],
  providers: [ProjectInitializationWorker],
  exports: [ProjectInitializationWorker, BullModule],
})
export class BusinessQueueModule {}
