#!/usr/bin/env bun
import * as schema from '@juanie/core/database'
import { desc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// 从环境变量构建连接字符串
const user = process.env.POSTGRES_USER || 'findbiao'
const password = process.env.POSTGRES_PASSWORD || 'biao1996.'
const host = process.env.POSTGRES_HOST || 'localhost'
const port = process.env.POSTGRES_PORT || '5432'
const database = process.env.POSTGRES_DB || 'juanie_devops'

const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`

const client = postgres(connectionString)
const db = drizzle(client, { schema })

async function main() {
  console.log('🔍 Checking latest project initialization steps...\n')

  const [project] = await db
    .select()
    .from(schema.projects)
    .orderBy(desc(schema.projects.createdAt))
    .limit(1)

  if (!project) {
    console.log('❌ No projects found')
    return
  }

  console.log(`Project ID: ${project.id}`)
  console.log(`Project Name: ${project.name}`)
  console.log(`Status: ${project.status}`)
  console.log(`Initialization Job ID: ${project.initializationJobId}`)
  console.log(`Initialization Error: ${project.initializationError || 'None'}`)
  console.log(`\n---\n`)

  // 查找初始化步骤
  const steps = await db
    .select()
    .from(schema.projectInitializationSteps)
    .where(eq(schema.projectInitializationSteps.projectId, project.id))
    .orderBy(schema.projectInitializationSteps.startedAt)

  console.log(`Initialization Steps (${steps.length}):`)
  for (const step of steps) {
    console.log(`\n  Step: ${step.step}`)
    console.log(`  Status: ${step.status}`)
    console.log(`  Started: ${step.startedAt}`)
    console.log(`  Completed: ${step.completedAt || 'N/A'}`)
    if (step.errorMessage) {
      console.log(`  Error: ${step.errorMessage}`)
    }
    if (step.metadata) {
      console.log(`  Metadata:`, JSON.stringify(step.metadata, null, 2))
    }
  }

  await client.end()
}

main().catch(console.error)
