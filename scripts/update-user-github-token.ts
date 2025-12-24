#!/usr/bin/env bun
/**
 * 更新用户的 GitHub Token
 * 用于修复 Token 权限不足的问题
 */

import { db } from '@juanie/core/database'
import { gitConnections } from '@juanie/core/database/schemas/git-connections.schema'
import { eq } from 'drizzle-orm'

// ⚠️ 替换为你的新 Token
const NEW_TOKEN = process.env.NEW_GITHUB_TOKEN || 'ghp_YOUR_NEW_TOKEN_HERE'
const USERNAME = '997899594'

async function updateToken() {
  console.log('🔄 更新 GitHub Token...')
  console.log(`📝 用户: ${USERNAME}`)
  console.log(`🔑 新 Token 前缀: ${NEW_TOKEN.substring(0, 10)}...`)

  if (NEW_TOKEN === 'ghp_YOUR_NEW_TOKEN_HERE') {
    console.error('❌ 请先设置 NEW_GITHUB_TOKEN 环境变量')
    console.error('   export NEW_GITHUB_TOKEN=ghp_your_actual_token')
    process.exit(1)
  }

  if (!NEW_TOKEN.startsWith('ghp_')) {
    console.error('❌ Token 格式错误，必须是 ghp_ 开头的 Personal Access Token')
    process.exit(1)
  }

  // 验证 Token 是否有效
  console.log('\n🔍 验证 Token 有效性...')
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${NEW_TOKEN}` },
  })

  if (!userResponse.ok) {
    console.error('❌ Token 无效或已过期')
    process.exit(1)
  }

  const userData = await userResponse.json()
  console.log(`✅ Token 有效，用户: ${userData.login}`)

  // 检查 Token 权限
  const scopes = userResponse.headers.get('x-oauth-scopes')
  console.log(`📋 Token 权限: ${scopes}`)

  if (!scopes?.includes('read:packages')) {
    console.warn('⚠️  警告: Token 没有 read:packages 权限，无法拉取镜像')
  }

  // 更新数据库
  console.log('\n💾 更新数据库...')
  const result = await db
    .update(gitConnections)
    .set({
      accessToken: NEW_TOKEN,
      updatedAt: new Date(),
    })
    .where(eq(gitConnections.username, USERNAME))
    .returning()

  if (result.length === 0) {
    console.error(`❌ 未找到用户 ${USERNAME} 的 Git 连接`)
    process.exit(1)
  }

  console.log('✅ Token 更新成功')
  console.log('\n📦 更新的记录:')
  console.log({
    id: result[0].id,
    username: result[0].username,
    provider: result[0].provider,
    tokenPrefix: result[0].accessToken.substring(0, 10) + '...',
    updatedAt: result[0].updatedAt,
  })

  console.log('\n✅ 完成！现在可以重新同步 ImagePullSecret')
  console.log('   bun run scripts/sync-imagepullsecret-11444a.ts')
}

updateToken().catch(console.error)
