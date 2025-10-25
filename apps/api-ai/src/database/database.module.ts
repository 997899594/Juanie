/**
 * 数据库模块 - 基于 Drizzle ORM + postgres.js
 * 支持多种数据库客户端：postgres.js、@neondatabase/serverless
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

// 导出 Database 类型
export type Database = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: async (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is required');
        }

        // 创建 postgres.js 连接
        const client = postgres(databaseUrl, {
          max: 10,
          idle_timeout: 20,
          connect_timeout: 10,
        });

        // 创建 Drizzle 实例
        const db = drizzle(client, { schema });
        
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}