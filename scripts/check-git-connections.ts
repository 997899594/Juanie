#!/usr/bin/env bun

/**
 * 检查 git_connections 表中的数据
 */

import * as schema from '@juanie/core/database'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/juanie'

const sql = postgres(DATABASE_URL)
const db = drizzle(sql, { schema })

async function main() {
  console.log('🔍 检查 git_connections 表...\n')

  const connections = await db.query.gitConnections.findMany({
    where: (gitConnections, { eq }) => eq(gitConnections.provider, 'github'),
    limit: 10,
  })

  if (connections.length === 0) {
    console.log('❌ 没有找到 GitHub 连接')
    process.exit(1)
  }

  console.log(`✅ 找到 ${connections.length} 个 GitHub 连接:\n`)

  for (const conn of connections) {
    console.log('---')
    console.log(`ID: ${conn.id}`)
    console.log(`User ID: ${conn.userId}`)
    console.log(`Provider: ${conn.provider}`)
    console.log(`Username: ${conn.username || '❌ NULL'}`)
    console.log(`Email: ${conn.email || '❌ NULL'}`)
    console.log(`Status: ${conn.status}`)
    console.log(`Access Token: ${conn.accessToken ? '✅ 存在 (已加密)' : '❌ NULL'}`)
    console.log(`Server URL: ${conn.serverUrl}`)
    console.log('')
  }

  await sql.end()
}

main().catch((error) => {
  console.error('❌ 错误:', error)
  process.exit(1)
})
