import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const sql = postgres({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'juanie_devops',
  username: process.env.POSTGRES_USER || 'findbiao',
  password: process.env.POSTGRES_PASSWORD || '',
})

async function applyMigration() {
  try {
    console.log('Applying migration 0002_sad_wolfsbane...')

    const migrationSQL = readFileSync(join(__dirname, '../drizzle/0002_sad_wolfsbane.sql'), 'utf-8')

    // 执行迁移
    await sql.unsafe(migrationSQL)

    console.log('✓ Migration applied successfully')
  } catch (error) {
    console.error('✗ Migration failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()
