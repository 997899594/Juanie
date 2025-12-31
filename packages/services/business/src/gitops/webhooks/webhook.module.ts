import { GitConnectionsModule, GitSyncLogsModule } from '@juanie/service-foundation'
import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ProjectsModule } from '../../projects/core'
import { ProjectMembersModule } from '../../projects/members'
import { GitSyncModule } from '../git-sync/git-sync.module'
import { GitPlatformSyncService } from './git-platform-sync.service'
import { WebhookController } from './webhook.controller'
import { WebhookService } from './webhook.service'
import { WebhookEventListener } from './webhook-event-listener.service'
import { WebhookEventProcessor } from './webhook-event-processor.service'

/**
 * Webhook 模块
 *
 * 提供 Git 平台 webhook 接收和处理功能
 *
 * Requirements: 5.1, 5.2, 5.3, 8.2, 8.3, 8.4
 *
 * 架构修复：
 * - ✅ 移除 DatabaseModule 直接导入（违反分层架构）
 * - ✅ 使用 GitConnectionsModule 从 Foundation 层获取 Git 连接数据
 * - ProjectMembersModule 使用事件驱动架构，不再直接依赖 GitSyncModule
 * - WebhookModule 仍需要 GitSyncModule 用于 webhook 事件处理
 * - GitPlatformSyncService 已重新启用，schema 已对齐
 */
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    GitConnectionsModule,
    GitSyncLogsModule, // 提供 GitSyncLogsService
    ProjectMembersModule,
    forwardRef(() => ProjectsModule),
    GitSyncModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookEventProcessor, WebhookEventListener, GitPlatformSyncService],
  exports: [WebhookService, WebhookEventProcessor, WebhookEventListener, GitPlatformSyncService],
})
export class WebhookModule {}
