/**
 * 🚀 Juanie AI - Drizzle ORM 配置
 * 现代化数据库ORM配置，支持类型安全和高性能查询
 */

import { defineConfig } from 'drizzle-kit';
import { getEnvVar, getBooleanEnvVar, getNumberEnvVar } from '../core';

export default defineConfig({
  // 数据库连接配置
  dialect: 'postgresql',
  dbCredentials: {
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getNumberEnvVar('DB_PORT', 5432),
    user: getEnvVar('DB_USER'),
    password: getEnvVar('DB_PASSWORD'),
    database: getEnvVar('DB_NAME'),
    ssl: getBooleanEnvVar('DB_SSL', true),
  },
  
  // Schema文件路径
  schema: [
    './src/database/schemas/*.schema.ts',
    './src/database/schemas/**/*.schema.ts',
  ],
  
  // 迁移文件配置
  out: './src/database/migrations',
  
  // 开发配置
  verbose: getBooleanEnvVar('DB_VERBOSE', false),
  strict: getBooleanEnvVar('DB_STRICT', true),
  
  // 内省配置
  introspect: {
    casing: 'camel',
  },
  
  // 迁移配置
  migrations: {
    prefix: 'timestamp',
    table: 'migrations',
    schema: 'public',
  },
  
  // 扩展配置
  extensionsFilters: ['postgis'],
});