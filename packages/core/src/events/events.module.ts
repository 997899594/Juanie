import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'

/**
 * 核心事件模块
 * 提供应用级事件总线
 */
@Module({
  imports: [
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
  exports: [EventEmitterModule],
})
export class CoreEventsModule {}
