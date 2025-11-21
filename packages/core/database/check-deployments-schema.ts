#!/usr/bin/env bun
/**
 * 检查 deployments 表的结构
 */
import postgres from 'postgres'

const connectionString = `postgresql://${process.env.POSTGRES_USER}:${encodeURIComponent(
  process.env.POSTGRES_PASSWORD || '',
)}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

const sql = postgres(connectionString, { max: 1 })

async function checkDeploymentsSchema() {
  try {
    console.log('🔍 检查 deployments 表结构...\n')

    const columns = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'deployments'
      ORDER BY ordinal_position
    `

    console.log('📋 deployments 表的列:')
    columns.forEach((col: any) => {
      console.log(
        `  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`,
      )
    })

    // 检查是否有 deleted_at 列
    const hasDeletedAt = columns.some((col: any) => col.column_name === 'deleted_at')
    console.log(`\n${hasDeletedAt ? '✅' : '❌'} deleted_at 列存在: ${hasDeletedAt}`)

    // 尝试查询
    console.log('\n🧪 测试查询...')
    try {
      const result = await sql`
        SELECT COUNT(*) as count 
        FROM deployments 
        WHERE deleted_at IS NULL
      `
      console.log(`✅ 查询成功，找到 ${result[0].count} 条记录`)
    } catch (error: any) {
      console.error('❌ 查询失败:', error.message)
    }
  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await sql.end()
  }
}

checkDeploymentsSchema()
