#!/usr/bin/env bun
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function verifySchema() {
  try {
    console.log('🔍 Verifying project_initialization_steps table schema...\n')

    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'project_initialization_steps'
      ORDER BY ordinal_position
    `

    console.log('📋 Table columns:')
    console.table(columns)

    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'project_initialization_steps'
    `

    console.log('\n📊 Table indexes:')
    console.table(indexes)

    console.log('\n✅ Schema verification completed!')
  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

verifySchema()
