import { DatabaseModule } from '@juanie/core/database'
import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ProjectMembersService } from '../../projects/project-members.service'
import { ProjectsService } from '../../projects/projects.service'
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
 */
@Module({
  imports: [ConfigModule, EventEmitterModule, DatabaseModule],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookEventProcessor,
    WebhookEventListener,
    GitPlatformSyncService,
    ProjectMembersService,
    ProjectsService,
  ],
  exports: [WebhookService, WebhookEventProcessor, WebhookEventListener, GitPlatformSyncService],
})
export class WebhookModule {}
