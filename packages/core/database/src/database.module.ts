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
        const connectionString = config.get<string>('DATABASE_URL')
        if (!connectionString) {
          throw new Error('DATABASE_URL 环境变量未设置')
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
