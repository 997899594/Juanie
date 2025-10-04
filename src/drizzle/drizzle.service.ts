import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private client!: postgres.Sql
  public db!: ReturnType<typeof drizzle>

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL')
    if (!connectionString) {
      console.warn('DATABASE_URL is not defined - database will be unavailable')
      return
    }

    try {
      this.client = postgres(connectionString, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      })

      this.db = drizzle(this.client, { schema })
      
      // 测试连接
      await this.client`SELECT 1`
      console.log('Database connection established successfully')
    } catch (error) {
      console.warn('Database connection failed - continuing without database:', (error as Error).message)
      // 不抛出错误，允许应用继续运行
      this.client = null as any
      this.db = null as any
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end()
    }
  }
}
