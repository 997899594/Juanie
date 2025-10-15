import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { ConfigService } from '../core/config/nestjs'
import * as schema from './schemas'

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  public readonly db: PostgresJsDatabase<typeof schema>
  private readonly client: postgres.Sql

  constructor(private configService: ConfigService) {
    const databaseConfig = this.configService.getDatabase()

    if (!databaseConfig.url) {
      throw new Error('DATABASE_URL is required')
    }

    this.client = postgres(databaseConfig.url, {
      max: databaseConfig.poolSize,
      ssl: databaseConfig.ssl,
      connect_timeout: databaseConfig.timeout / 1000, // postgres.js expects seconds
    })
    this.db = drizzle(this.client, { schema })
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end()
    }
  }
}
