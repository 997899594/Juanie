#!/usr/bin/env bun

/**
 * 清空数据库所有数据
 * ⚠️ 危险操作：会删除所有表中的数据
 */

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

const client = postgres(connectionString)
const db = drizzle(client)

async function cleanDatabase() {
  console.log('⚠️  警告：即将清空数据库所有数据！')
  console.log('数据库:', process.env.POSTGRES_DB)
  console.log()

  // 等待 3 秒确认
  console.log('3 秒后开始清理...')
  await new Promise((resolve) => setTimeout(resolve, 3000))

  try {
    console.log('🗑️  开始清理数据库...\n')

    // 获取所有表
    const tables = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)

    console.log(`找到 ${tables.length} 个表：`)
    for (const table of tables) {
      console.log(`  - ${table.tablename}`)
    }
    console.log()

    // 禁用外键约束
    await db.execute(sql`SET session_replication_role = 'replica'`)

    // 清空所有表
    for (const table of tables) {
      const tableName = table.tablename as string
      console.log(`清空表: ${tableName}`)
      await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`))
    }

    // 恢复外键约束
    await db.execute(sql`SET session_replication_role = 'origin'`)

    console.log()
    console.log('✅ 数据库清理完成！')
    console.log()
    console.log('下一步：')
    console.log('1. 重启服务: bun run dev')
    console.log('2. 创建新项目测试')
  } catch (error) {
    console.error('❌ 清理失败:', error)
    throw error
  } finally {
    await client.end()
  }
}

cleanDatabase().catch(console.error)
