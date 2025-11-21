#!/usr/bin/env bun

/**
 * OAuth 账户数据迁移脚本
 * 为现有的 OAuth 账户设置默认的 server_url 和 server_type
 */

import { and, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { oauthAccounts } from '../schemas/oauth-accounts.schema'

// 从环境变量构建数据库 URL
const dbUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${encodeURIComponent(
    process.env.POSTGRES_PASSWORD || '',
  )}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

const client = postgres(dbUrl)
const db = drizzle(client)

async function migrateOAuthAccounts() {
  console.log('🔄 开始迁移 OAuth 账户数据...')

  try {
    // 更新 GitHub 账户
    const githubResult = await db
      .update(oauthAccounts)
      .set({
        serverUrl: 'https://github.com',
        serverType: 'cloud',
        metadata: {},
      })
      .where(and(eq(oauthAccounts.provider, 'github'), isNull(oauthAccounts.serverUrl)))
      .returning({ id: oauthAccounts.id })

    console.log(`✅ 已更新 ${githubResult.length} 个 GitHub 账户`)

    // 更新 GitLab 账户
    const gitlabResult = await db
      .update(oauthAccounts)
      .set({
        serverUrl: 'https://gitlab.com',
        serverType: 'cloud',
        metadata: {},
      })
      .where(and(eq(oauthAccounts.provider, 'gitlab'), isNull(oauthAccounts.serverUrl)))
      .returning({ id: oauthAccounts.id })

    console.log(`✅ 已更新 ${gitlabResult.length} 个 GitLab 账户`)

    console.log('🎉 OAuth 账户数据迁移完成！')
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// 运行迁移
migrateOAuthAccounts()
