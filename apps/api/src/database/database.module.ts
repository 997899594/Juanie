import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import Redis from 'ioredis'
import postgres from 'postgres'
import * as schema from './schemas'

export const DATABASE = Symbol('DATABASE')
export const REDIS = Symbol('REDIS')

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL')!

        // 优化的连接配置（配合 PgBouncer 使用）
        const client = postgres(connectionString, {
          max: 10, // 减少连接数，因为有 PgBouncer
          idle_timeout: 20, // 20 秒空闲超时
          connect_timeout: 10, // 10 秒连接超时
          prepare: false, // PgBouncer transaction mode 需要禁用 prepared statements
        })

        return drizzle(client, { schema })
      },
    },
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL')!

        // Dragonfly (Redis 兼容，25x 性能提升)
        // 使用 ioredis 客户端，完全兼容 Dragonfly
        return new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          enableOfflineQueue: true,
          connectTimeout: 10000,
          lazyConnect: false,
          // Dragonfly 优化：支持更高并发和更快的响应
        })
      },
    },
  ],
  exports: [DATABASE, REDIS],
})
export class DatabaseModule {}
