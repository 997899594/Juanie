import { DATABASE, REDIS } from '@juanie/core-tokens'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import Redis from 'ioredis'
import postgres from 'postgres'
import * as schema from './schemas'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE,
      useFactory: (config: ConfigService) => {
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
          console.log(
            `📦 使用自动构建的数据库连接: postgresql://${user}:***@${host}:${port}/${database}`,
          )
        }

        const client = postgres(connectionString)
        return drizzle(client, { schema })
      },
      inject: [ConfigService],
    },
    {
      provide: REDIS,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Redis(redisUrl)
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE, REDIS],
})
export class DatabaseModule {}
