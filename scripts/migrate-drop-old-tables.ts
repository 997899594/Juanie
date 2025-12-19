#!/usr/bin/env bun
/**
 * 数据库重构迁移脚本
 * 删除旧表 oauth_accounts 和 user_git_accounts
 */

import { config } from 'dotenv'
import postgres from 'postgres'

// 加载 .env 文件
config()

// 构建 DATABASE_URL
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

console.log('📦 连接数据库:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'))

const sql = postgres(DATABASE_URL)

async function migrate() {
  console.log('🚀 开始数据库迁移：删除旧表...\n')

  try {
    // Step 1: 删除旧的外键约束
    console.log('📝 Step 1: 删除旧的外键约束...')
    await sql`
      ALTER TABLE "project_git_auth" 
      DROP CONSTRAINT IF EXISTS "project_git_auth_oauth_account_id_oauth_accounts_id_fk"
    `
    console.log('✅ 外键约束已删除\n')

    // Step 2: 清空 project_git_auth 表（开发阶段）
    console.log('📝 Step 2: 清空 project_git_auth 表...')
    const result = await sql`TRUNCATE TABLE "project_git_auth" CASCADE`
    console.log('✅ project_git_auth 表已清空\n')

    // Step 3: 删除旧表
    console.log('📝 Step 3: 删除旧表...')
    await sql`DROP TABLE IF EXISTS "oauth_accounts" CASCADE`
    console.log('✅ oauth_accounts 表已删除')

    await sql`DROP TABLE IF EXISTS "user_git_accounts" CASCADE`
    console.log('✅ user_git_accounts 表已删除\n')

    // Step 4: 添加新的外键约束
    console.log('📝 Step 4: 添加新的外键约束...')
    await sql`
      ALTER TABLE "project_git_auth" 
      ADD CONSTRAINT "project_git_auth_oauth_account_id_git_connections_id_fk" 
      FOREIGN KEY ("oauth_account_id") 
      REFERENCES "public"."git_connections"("id") 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION
    `
    console.log('✅ 新的外键约束已添加\n')

    console.log('🎉 数据库迁移完成！')
    console.log('\n📊 迁移摘要：')
    console.log('  - 删除了 oauth_accounts 表')
    console.log('  - 删除了 user_git_accounts 表')
    console.log('  - 更新了 project_git_auth 外键指向 git_connections')
    console.log('  - 清空了 project_git_auth 表（开发阶段）')
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

migrate()
