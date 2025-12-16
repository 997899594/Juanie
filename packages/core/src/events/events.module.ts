import { Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { LoggerModule } from 'nestjs-pino'
import { EventPublisher } from './event-publisher.service'
import { EventReplayService } from './event-replay.service'

/**
 * 核心事件模块
 * 提供统一的事件系统
 *
 * 功能：
 * - 领域事件（NestJS EventEmitter）
 * - 集成事件（BullMQ）
 * - 实时事件（Redis Pub/Sub）
 * - 事件重放和查询
 */
@Global()
@Module({
  imports: [
    LoggerModule,
    EventEmitterModule.forRoot({
      // 使用通配符
      wildcard: true,
      // 分隔符
      delimiter: '.',
      // 最大监听器数量
      maxListeners: 20,
      // 详细日志（开发环境）
      verboseMemoryLeak: process.env.NODE_ENV === 'development',
    }),
  ],
  providers: [EventPublisher, EventReplayService],
  exports: [EventEmitterModule, EventPublisher, EventReplayService],
})
export class CoreEventsModule {}
