/**
 * Drizzle 配置文件
 * 支持数据库迁移、Studio和开发工具
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schemas/*',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/juanie_ai_devops',
  },
  verbose: true,
  strict: true,
});