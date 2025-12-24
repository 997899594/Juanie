#!/usr/bin/env bun
import { eq, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { projects, repositories } from '../packages/core/src/database/index'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

// 查找项目 ID 为 56d0416c-5fc9-40bc-be8a-85c8adf889a4 的项目
const project = await db
  .select()
  .from(projects)
  .where(eq(projects.id, '56d0416c-5fc9-40bc-be8a-85c8adf889a4'))
  .limit(1)

console.log('=== 项目 56d0416c (最新创建) ===')
console.log(JSON.stringify(project, null, 2))

if (project[0]?.repositoryId) {
  const repo = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, project[0].repositoryId))
    .limit(1)
  console.log('\n=== 关联的仓库 ===')
  console.log(JSON.stringify(repo, null, 2))
}

// 也查找名称包含 "eee" 的项目
const eeeProjects = await db.select().from(projects).where(like(projects.name, '%eee%'))

console.log('\n=== 名称包含 "eee" 的所有项目 ===')
console.log(JSON.stringify(eeeProjects, null, 2))

await client.end()
