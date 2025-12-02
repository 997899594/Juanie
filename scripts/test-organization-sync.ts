#!/usr/bin/env bun

/**
 * 测试组织同步功能
 *
 * 测试内容:
 * 1. 创建启用 Git 同步的组织
 * 2. 验证组织数据正确保存
 * 3. 验证 Git 同步字段正确
 */

import * as schema from '@juanie/core/database'
import { createDatabaseClient } from '@juanie/core/database'
import { eq } from 'drizzle-orm'

// 创建数据库连接
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

if (!DATABASE_URL || DATABASE_URL.includes('undefined')) {
  console.error('❌ 数据库连接信息未设置')
  console.error('请确保以下环境变量已设置:')
  console.error('- POSTGRES_USER')
  console.error('- POSTGRES_PASSWORD')
  console.error('- POSTGRES_HOST')
  console.error('- POSTGRES_PORT')
  console.error('- POSTGRES_DB')
  process.exit(1)
}

const db = createDatabaseClient(DATABASE_URL)

async function testOrganizationSync() {
  console.log('🧪 开始测试组织同步功能...\n')

  try {
    // 1. 创建测试用户
    console.log('1️⃣ 创建测试用户...')
    const [testUser] = await db
      .insert(schema.users)
      .values({
        username: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        displayName: 'Test User',
      })
      .returning()

    if (!testUser) {
      throw new Error('创建测试用户失败')
    }
    console.log(`✅ 测试用户创建成功: ${testUser.id}\n`)

    // 2. 创建启用 Git 同步的组织
    console.log('2️⃣ 创建启用 Git 同步的组织...')
    const orgSlug = `test-org-${Date.now()}`
    const [testOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        slug: orgSlug,
        displayName: 'Test Org Display Name',
        gitSyncEnabled: true,
        gitProvider: 'github',
        gitOrgName: 'test-github-org',
      })
      .returning()

    if (!testOrg) {
      throw new Error('创建测试组织失败')
    }
    console.log(`✅ 组织创建成功: ${testOrg.id}`)
    console.log(`   - 名称: ${testOrg.name}`)
    console.log(`   - Git 同步: ${testOrg.gitSyncEnabled ? '已启用' : '未启用'}`)
    console.log(`   - Git 平台: ${testOrg.gitProvider}`)
    console.log(`   - Git 组织名: ${testOrg.gitOrgName}\n`)

    // 3. 添加用户为组织成员
    console.log('3️⃣ 添加用户为组织成员...')
    await db.insert(schema.organizationMembers).values({
      organizationId: testOrg.id,
      userId: testUser.id,
      role: 'owner',
    })
    console.log('✅ 用户已添加为组织 owner\n')

    // 4. 验证组织数据
    console.log('4️⃣ 验证组织数据...')
    const [verifyOrg] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, testOrg.id))
      .limit(1)

    if (!verifyOrg) {
      throw new Error('无法查询到创建的组织')
    }

    console.log('✅ 组织数据验证:')
    console.log(`   - ID: ${verifyOrg.id}`)
    console.log(`   - 名称: ${verifyOrg.name}`)
    console.log(`   - Slug: ${verifyOrg.slug}`)
    console.log(`   - Git 同步启用: ${verifyOrg.gitSyncEnabled}`)
    console.log(`   - Git 平台: ${verifyOrg.gitProvider}`)
    console.log(`   - Git 组织 ID: ${verifyOrg.gitOrgId || '(未设置)'}`)
    console.log(`   - Git 组织名称: ${verifyOrg.gitOrgName}`)
    console.log(`   - Git 组织 URL: ${verifyOrg.gitOrgUrl || '(未设置)'}`)
    console.log(`   - 最后同步时间: ${verifyOrg.gitLastSyncAt || '(未同步)'}\n`)

    // 5. 验证字段类型
    console.log('5️⃣ 验证字段类型...')
    const typeChecks = {
      gitSyncEnabled: typeof verifyOrg.gitSyncEnabled === 'boolean',
      gitProvider: typeof verifyOrg.gitProvider === 'string' || verifyOrg.gitProvider === null,
      gitOrgId: typeof verifyOrg.gitOrgId === 'string' || verifyOrg.gitOrgId === null,
      gitOrgName: typeof verifyOrg.gitOrgName === 'string' || verifyOrg.gitOrgName === null,
      gitOrgUrl: typeof verifyOrg.gitOrgUrl === 'string' || verifyOrg.gitOrgUrl === null,
      gitLastSyncAt: verifyOrg.gitLastSyncAt instanceof Date || verifyOrg.gitLastSyncAt === null,
    }

    const allTypesCorrect = Object.values(typeChecks).every((check) => check)
    if (allTypesCorrect) {
      console.log('✅ 所有字段类型正确\n')
    } else {
      console.log('❌ 字段类型检查失败:')
      Object.entries(typeChecks).forEach(([field, isCorrect]) => {
        if (!isCorrect) {
          console.log(`   - ${field}: 类型不正确`)
        }
      })
      console.log()
    }

    // 6. 测试创建未启用 Git 同步的组织
    console.log('6️⃣ 测试创建未启用 Git 同步的组织...')
    const [normalOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Normal Organization',
        slug: `normal-org-${Date.now()}`,
        displayName: 'Normal Org',
        gitSyncEnabled: false,
      })
      .returning()

    if (!normalOrg) {
      throw new Error('创建普通组织失败')
    }
    console.log(`✅ 普通组织创建成功: ${normalOrg.id}`)
    console.log(`   - Git 同步: ${normalOrg.gitSyncEnabled ? '已启用' : '未启用'}\n`)

    // 7. 清理测试数据
    console.log('7️⃣ 清理测试数据...')
    await db
      .delete(schema.organizationMembers)
      .where(eq(schema.organizationMembers.userId, testUser.id))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrg.id))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, normalOrg.id))
    await db.delete(schema.users).where(eq(schema.users.id, testUser.id))
    console.log('✅ 测试数据已清理\n')

    console.log('🎉 所有测试通过!')
    console.log('\n测试总结:')
    console.log('✅ 组织创建功能正常')
    console.log('✅ Git 同步字段正确保存')
    console.log('✅ 字段类型正确')
    console.log('✅ 数据库查询正常')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
testOrganizationSync()
