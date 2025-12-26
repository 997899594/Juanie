import { DatabaseModule } from '@juanie/core/database'
import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'

/**
 * Core Queue Module
 *
 * 使用 @nestjs/bullmq 提供全局 BullMQ 配置
 *
 * 架构说明：
 * - Core 层：配置全局 Redis 连接（BullModule.forRoot）
 * - Business 层：注册具体队列和 Worker（BullModule.registerQueue + @Processor）
 *
 * 不再手动创建 Queue 实例，完全使用 @nestjs/bullmq
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule,
    // 配置全局 BullMQ 连接
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: {
              age: 3600, // 保留 1 小时
              count: 100,
            },
            removeOnFail: {
              age: 86400, // 保留 24 小时
            },
          },
        }
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
