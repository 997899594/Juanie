import { afterAll, afterEach, beforeAll } from 'vitest'
import { clearDatabase, closeTestDatabase } from './test-database'

// 全局测试设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test'

  // 使用开发数据库作为测试数据库（会在每个测试后清理）
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops'

  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/15'

  // 禁用 OpenTelemetry 在测试环境
  process.env.OTEL_SDK_DISABLED = 'true'

  console.log('🧪 Test environment initialized')
  console.log('📊 Database:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))
})

afterAll(async () => {
  // 关闭数据库连接
  await closeTestDatabase()
  console.log('✅ Test environment cleaned up')
})

afterEach(async () => {
  // 每个测试后清理数据库
  await clearDatabase()
})
