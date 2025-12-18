import { Logger } from '@juanie/core/logger'
import { DATABASE, REDIS } from '@juanie/core/tokens'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import Redis from 'ioredis'
import { LoggerModule } from 'nestjs-pino'
import postgres from 'postgres'
import * as relations from './relations'
import * as tables from './schemas'

// 合并表定义和关系定义
const schema = { ...tables, ...relations }

@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [
    {
      provide: DATABASE,
      useFactory: (config: ConfigService, logger: Logger) => {
        logger.setContext('Database')

        // 优先使用 DATABASE_URL,如果没有则从 POSTGRES_* 变量构建
        let connectionString = config.get<string>('DATABASE_URL')

        if (!connectionString) {
          const user = config.get<string>('POSTGRES_USER')
          const password = config.get<string>('POSTGRES_PASSWORD')
          const host = config.get<string>('POSTGRES_HOST') || 'localhost'
          const port = config.get<string>('POSTGRES_PORT') || '5432'
          const database = config.get<string>('POSTGRES_DB')

          if (!user || !password || !database) {
            throw new Error(
              '数据库配置错误: 请设置 DATABASE_URL 或 POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB',
            )
          }

          connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`
          logger.info(
            `📦 使用自动构建的数据库连接: postgresql://${user}:***@${host}:${port}/${database}`,
          )
        }

        const client = postgres(connectionString)

        // SQL 日志（开发调试用）
        const shouldLogQueries = process.env.LOG_SQL === 'true'
        const customLogger = shouldLogQueries
          ? {
              logQuery(query: string, params: unknown[]) {
                // 截断过长的 SQL，保持日志简洁
                const maxLen = 200
                const shortQuery = query.length > maxLen ? `${query.slice(0, maxLen)}...` : query
                logger.info(`SQL: ${shortQuery}`, { params })
              },
            }
          : false

        return drizzle(client, {
          schema,
          logger: customLogger,
        })
      },
      inject: [ConfigService, Logger],
    },
    {
      provide: REDIS,
      useFactory: (config: ConfigService, logger: Logger) => {
        logger.setContext('Redis')
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        const redis = new Redis(redisUrl, {
          lazyConnect: true,
          enableReadyCheck: false, // 禁用版本检查，避免警告
        })

        redis.on('connect', () => logger.info('Redis connected'))
        redis.on('error', (err) => logger.error('Redis error', { error: err.message }))

        return redis
      },
      inject: [ConfigService, Logger],
    },
  ],
  exports: [DATABASE, REDIS],
})
export class DatabaseModule {}
