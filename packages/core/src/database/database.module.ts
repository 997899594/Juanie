import { DATABASE } from '@juanie/core/tokens'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule, PinoLogger } from 'nestjs-pino'
import { createDatabaseClient, type DatabaseClient } from './client'

/**
 * Database Module
 *
 * 提供 PostgreSQL 连接的全局模块
 * 使用 client.ts 中的 createDatabaseClient 创建连接
 */
@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [
    {
      provide: DATABASE,
      useFactory: (config: ConfigService, logger: PinoLogger): DatabaseClient => {
        logger.setContext('Database')

        // 获取连接字符串
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

        // SQL 日志配置
        const shouldLogQueries = process.env.LOG_SQL === 'true'
        const customLogger = shouldLogQueries
          ? {
              logQuery(query: string, params: unknown[]) {
                const maxLen = 200
                const shortQuery = query.length > maxLen ? `${query.slice(0, maxLen)}...` : query
                logger.info(`SQL: ${shortQuery}`, { params })
              },
            }
          : false

        // 使用统一的 createDatabaseClient
        return createDatabaseClient({
          connectionString,
          logger: customLogger,
        })
      },
      inject: [ConfigService, PinoLogger],
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
