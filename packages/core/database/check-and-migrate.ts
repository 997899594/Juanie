#!/usr/bin/env bun
/**
 * 检查数据库状态并运行迁移
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// 从环境变量构建连接字符串
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${encodeURIComponent(
    process.env.POSTGRES_PASSWORD || '',
  )}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

console.log('🔍 检查数据库连接...')
console.log(`📍 连接到: ${connectionString.replace(/:[^:@]+@/, ':****@')}`)

const sql = postgres(connectionString, { max: 1 })
const db = drizzle(sql)

async function checkTables() {
  try {
    // 检查关键表是否存在
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `

    console.log('\n📊 现有表:')
    if (tables.length === 0) {
      console.log('  ❌ 没有找到任何表')
    } else {
      tables.forEach((t: any) => {
        console.log(`  ✓ ${t.table_name}`)
      })
    }

    // 检查关键表
    const requiredTables = [
      'users',
      'organizations',
      'projects',
      'environments',
      'repositories',
      'deployments',
      'oauth_accounts',
      'gitops_resources',
    ]

    const existingTableNames = tables.map((t: any) => t.table_name)
    const missingTables = requiredTables.filter((t) => !existingTableNames.includes(t))

    if (missingTables.length > 0) {
      console.log('\n⚠️  缺少的表:')
      missingTables.forEach((t) => {
        console.log(`  ❌ ${t}`)
      })
      return false
    }

    console.log('\n✅ 所有必需的表都存在')
    return true
  } catch (error) {
    console.error('❌ 检查表失败:', error)
    return false
  }
}

async function runMigrations() {
  try {
    console.log('\n🚀 运行数据库迁移...')

    await migrate(db, {
      migrationsFolder: './drizzle',
    })

    console.log('✅ 迁移完成')
    return true
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    return false
  }
}

async function main() {
  try {
    // 1. 检查当前表状态
    const tablesExist = await checkTables()

    // 2. 如果缺少表，运行迁移
    if (!tablesExist) {
      console.log('\n📝 需要运行迁移...')
      const migrated = await runMigrations()

      if (migrated) {
        // 再次检查
        await checkTables()
      }
    }

    console.log('\n✨ 数据库检查完成')
  } catch (error) {
    console.error('❌ 错误:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
