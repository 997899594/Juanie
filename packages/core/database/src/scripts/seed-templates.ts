#!/usr/bin/env bun
/**
 * Seed script for project templates
 * Usage: bun run src/scripts/seed-templates.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { projectTemplates } from '../schemas/project-templates.schema'
import { systemTemplates } from '../seeds/project-templates.seed'

async function seedTemplates() {
  // 从环境变量获取数据库连接
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

  const client = postgres(connectionString)
  const db = drizzle(client)

  console.log('🌱 Seeding project templates...')

  try {
    // 插入系统模板
    for (const template of systemTemplates) {
      console.log(`  - Inserting template: ${template.name}`)
      await db.insert(projectTemplates).values(template).onConflictDoNothing()
    }

    console.log('✅ Successfully seeded project templates!')
  } catch (error) {
    console.error('❌ Error seeding templates:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// 运行 seed
seedTemplates()
