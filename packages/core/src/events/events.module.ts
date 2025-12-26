import { Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'

/**
 * 核心事件模块
 * 简单的 EventEmitter2 封装，提供全局事件系统
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: process.env.NODE_ENV === 'development',
    }),
  ],
  exports: [EventEmitterModule],
})
export class CoreEventsModule {}
