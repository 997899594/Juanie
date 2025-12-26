import { REDIS } from '@juanie/core/tokens'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule, PinoLogger } from 'nestjs-pino'
import { createRedisClient, type RedisClient } from './client'

/**
 * Redis Module
 *
 * 提供 Redis 连接的全局模块
 * 使用 client.ts 中的 createRedisClient 创建连接
 */
@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService, logger: PinoLogger): RedisClient => {
        logger.setContext('Redis')
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'

        // 使用统一的 createRedisClient
        return createRedisClient({
          url: redisUrl,
          onConnect: () => logger.info('Redis connected'),
          onError: (err) => logger.error('Redis error', { error: err.message }),
        })
      },
      inject: [ConfigService, PinoLogger],
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
