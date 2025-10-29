import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../src/database/schemas'

let testDb: ReturnType<typeof drizzle> | null = null
let testClient: ReturnType<typeof postgres> | null = null

/**
 * 获取测试数据库实例
 */
export function getTestDatabase() {
  if (!testDb) {
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops'

    testClient = postgres(connectionString, {
      max: 1, // 测试环境只需要一个连接
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    })

    testDb = drizzle(testClient, { schema })
  }

  return testDb
}

/**
 * 清理所有表数据（保留表结构）
 */
export async function clearDatabase() {
  const db = getTestDatabase()

  // 按依赖顺序清理表（从子表到父表）
  const tables = [
    // CI/CD 相关
    'deployment_approvals',
    'deployments',
    'pipeline_runs',
    'pipelines',

    // 项目相关
    'team_projects',
    'project_members',
    'environments',
    'repositories',
    'projects',

    // 团队相关
    'team_members',
    'teams',

    // 组织相关
    'organization_members',
    'organizations',

    // 系统表
    'notifications',
    'audit_logs',
    'incidents',
    'security_policies',
    'cost_tracking',
    'ai_assistants',

    // 用户相关
    'oauth_accounts',
    'users',
  ]

  for (const table of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`))
  }
}

/**
 * 关闭测试数据库连接
 */
export async function closeTestDatabase() {
  if (testClient) {
    await testClient.end()
    testClient = null
    testDb = null
  }
}

/**
 * 在事务中运行测试（测试后自动回滚）
 */
export async function runInTransaction<T>(
  callback: (tx: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  const db = getTestDatabase()

  return await db
    .transaction(async (tx) => {
      const result = await callback(tx)
      // 抛出错误以触发回滚
      throw new Error('ROLLBACK_TEST_TRANSACTION')
    })
    .catch((error) => {
      if (error.message === 'ROLLBACK_TEST_TRANSACTION') {
        // 这是预期的回滚，返回结果
        return undefined as T
      }
      throw error
    })
}
