#!/usr/bin/env bun

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../packages/core/database/src/schemas/index'

const client = postgres(
  process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
)
const db = drizzle(client, { schema })

const [project] = await db
  .select()
  .from(schema.projects)
  .orderBy(schema.projects.createdAt)
  .limit(1)
if (!project) {
  console.log('没有项目')
  process.exit(0)
}

const [user] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.id, project.createdBy || ''))
  .limit(1)
const accounts = await db
  .select()
  .from(schema.oauthAccounts)
  .where(eq(schema.oauthAccounts.userId, user?.id || ''))

console.log('项目:', project.name)
console.log('创建者:', user?.username)
console.log(
  'OAuth 账户:',
  accounts.map((a) => `${a.provider} - ${a.status} - ${a.accessToken ? '有token' : '无token'}`),
)

await client.end()
