import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schemas'

@Injectable()
export class DrizzleService {
  public readonly db: ReturnType<typeof drizzle<typeof schema>>

  constructor(private readonly configService: ConfigService) {
    // 使用 NestJS 官方 ConfigService 获取配置
    const databaseUrl = this.configService.get<string>('DATABASE_URL')
    const poolSize = this.configService.get<number>('DATABASE_POOL_SIZE', 10)
    const ssl = this.configService.get<boolean>('DATABASE_SSL', false)
    const timeout = this.configService.get<number>('DATABASE_TIMEOUT', 30)

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured')
    }

    const sql = postgres(databaseUrl, {
      max: poolSize,
      ssl: ssl,
      idle_timeout: timeout,
    })

    this.db = drizzle(sql, { schema })
  }
}
