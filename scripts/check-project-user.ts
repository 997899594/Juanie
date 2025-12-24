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
  console.log('🔍 Checking latest project and its user...\n')

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
  console.log(`Organization ID: ${project.organizationId}`)
  console.log(`Status: ${project.status}`)
  console.log(`Created: ${project.createdAt}`)
  console.log(`\n---\n`)

  // 查找组织成员
  const members = await db
    .select()
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.organizationId, project.organizationId))

  console.log(`Organization Members (${members.length}):`)
  for (const member of members) {
    console.log(`  - User ID: ${member.userId}`)
    console.log(`    Role: ${member.role}`)
    console.log(`    Joined: ${member.joinedAt}`)
    console.log()
  }

  // 查找对应的 repository
  const [repo] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.projectId, project.id))
    .limit(1)

  if (repo) {
    console.log('---\n')
    console.log('Repository Info:')
    console.log(`  Full Name: ${repo.fullName}`)
    console.log(`  Provider: ${repo.provider}`)
    console.log(`  Clone URL: ${repo.cloneUrl}`)
  }

  await client.end()
}

main().catch(console.error)
