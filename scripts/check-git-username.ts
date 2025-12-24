#!/usr/bin/env bun
import * as schema from '@juanie/core/database'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// 从环境变量构建连接字符串
const user = process.env.POSTGRES_USER || 'findbiao'
const password = process.env.POSTGRES_PASSWORD || 'biao1996.'
const host = process.env.POSTGRES_HOST || 'localhost'
const port = process.env.POSTGRES_PORT || '5432'
const database = process.env.POSTGRES_DB || 'juanie_devops'

const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`

console.log(`🔗 Connecting to: postgresql://${user}:***@${host}:${port}/${database}\n`)

const client = postgres(connectionString)
const db = drizzle(client, { schema })

async function main() {
  console.log('🔍 Checking git_connections table...\n')

  const connections = await db
    .select({
      id: schema.gitConnections.id,
      userId: schema.gitConnections.userId,
      provider: schema.gitConnections.provider,
      providerAccountId: schema.gitConnections.providerAccountId,
      username: schema.gitConnections.username,
      email: schema.gitConnections.email,
      status: schema.gitConnections.status,
      createdAt: schema.gitConnections.createdAt,
    })
    .from(schema.gitConnections)
    .orderBy(schema.gitConnections.createdAt)
    .limit(10)

  if (connections.length === 0) {
    console.log('❌ No git connections found')
    console.log('\n💡 Tip: 请先在前端登录 GitHub，系统会自动创建 Git 连接')
  } else {
    console.log(`✅ Found ${connections.length} git connections:\n`)
    for (const conn of connections) {
      console.log(`Provider: ${conn.provider}`)
      console.log(`Provider Account ID: ${conn.providerAccountId}`)
      console.log(`Username: ${conn.username || '❌ NULL'}`)
      console.log(`Email: ${conn.email || 'N/A'}`)
      console.log(`Status: ${conn.status}`)
      console.log(`User ID: ${conn.userId}`)
      console.log(`Created: ${conn.createdAt}`)
      console.log('---')
    }
  }

  await client.end()
}

main().catch(console.error)
