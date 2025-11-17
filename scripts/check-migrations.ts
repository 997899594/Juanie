import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString)
const db = drizzle(client)

async function checkMigrations() {
  try {
    // 查询迁移记录表
    const result = await client`
      SELECT * FROM __drizzle_migrations 
      ORDER BY created_at DESC
    `

    console.log('Migration records:')
    console.table(result)

    // 检查 projects 表的索引
    const indexes = await client`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'projects' 
      AND indexname = 'projects_org_slug_unique'
    `

    console.log('\nCurrent unique index:')
    console.table(indexes)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

checkMigrations()
