#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,
})

async function runMigration() {
  try {
    console.log('🔄 Running migration: 0001_add_initialization_steps.sql')

    const migrationPath = join(
      process.cwd(),
      'packages/database/src/migrations/0001_add_initialization_steps.sql',
    )
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    await sql.unsafe(migrationSQL)

    console.log('✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

runMigration()
