/**
 * 类型测试文件
 * 用于验证 Drizzle 类型推断是否正确
 */

import * as schema from '@juanie/database'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

// 测试 Organization 类型
type Org = typeof schema.organizations.$inferSelect
const testOrg: Org = {} as any

// 检查 type 字段
const orgType: 'personal' | 'team' = testOrg.type
console.log('Organization type:', orgType)

// 检查 gitProvider 字段
const gitProvider: 'github' | 'gitlab' | null = testOrg.gitProvider
console.log('Git provider:', gitProvider)

// 测试查询类型
type DB = PostgresJsDatabase<typeof schema>

async function testQuery(db: DB) {
  // 测试基本查询
  const org = await db.query.organizations.findFirst({
    where: (orgs, { eq }) => eq(orgs.id, 'test-id'),
  })

  if (org) {
    // 这应该能正确推断类型
    const type: 'personal' | 'team' = org.type
    const provider: 'github' | 'gitlab' | null = org.gitProvider
    console.log('Query result type:', type, provider)
  }

  // 测试关系查询
  const members = await db.query.organizationMembers.findMany({
    where: (members, { eq }) => eq(members.organizationId, 'test-id'),
    with: {
      user: {
        with: {
          gitAccounts: true,
        },
      },
    },
  })

  if (members.length > 0) {
    const member = members[0]
    // 这应该能访问 user 和 gitAccounts
    const user = member.user
    const gitAccounts = user.gitAccounts
    console.log('Member user:', user.email)
    console.log('Git accounts:', gitAccounts.length)
  }
}

export { testQuery }
