#!/usr/bin/env bun
import { readFileSync } from 'fs'
import { join } from 'path'
/**
 * 手动运行迁移
 */
import postgres from 'postgres'

const connectionString = `postgresql://${process.env.POSTGRES_USER}:${encodeURIComponent(
  process.env.POSTGRES_PASSWORD || '',
)}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

const sql = postgres(connectionString, { max: 1 })

async function runMigration() {
  try {
    console.log('🚀 运行迁移 0007...\n')

    // 读取迁移文件
    const migrationSQL = readFileSync(
      join(__dirname, 'drizzle/0007_left_the_santerians.sql'),
      'utf-8',
    )

    // 分割并执行每个语句
    const statements = migrationSQL
      .split('-->')[0] // 移除注释
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      console.log(`执行: ${statement.substring(0, 80)}...`)
      await sql.unsafe(statement)
      console.log('✅ 成功\n')
    }

    console.log('✨ 迁移完成')
  } catch (error: any) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    await sql.end()
  }
}

runMigration()
