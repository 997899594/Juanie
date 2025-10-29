# 测试指南

本文档介绍如何在 AI DevOps 平台中编写和运行测试。

## 目录

- [测试框架](#测试框架)
- [运行测试](#运行测试)
- [测试结构](#测试结构)
- [测试工具函数](#测试工具函数)
- [编写测试](#编写测试)
- [测试覆盖率](#测试覆盖率)
- [最佳实践](#最佳实践)

## 测试框架

我们使用 **Vitest** 作为测试框架，它提供：

- ⚡️ 极快的测试执行速度（基于 Vite）
- 🔄 智能监听模式
- 📊 内置代码覆盖率
- 🎯 与 Jest 兼容的 API
- 🧩 TypeScript 原生支持

## 测试环境设置

### 数据库配置

测试使用开发数据库，每个测试后会自动清理数据。不需要创建单独的测试数据库。

**重要**: 测试会清理数据库中的所有数据，请确保：
1. 使用开发环境数据库（不是生产环境）
2. 或者创建专门的测试数据库

#### 选项1: 使用开发数据库（推荐）

测试会自动使用 `.env` 中的 `DATABASE_URL`，并在每个测试后清理数据。

```bash
# 确保开发数据库正在运行
docker-compose up -d postgres

# 运行测试（会自动清理数据）
bun test
```

#### 选项2: 使用独立的测试数据库

如果你想使用独立的测试数据库：

```bash
# 创建测试数据库
createdb devops_test

# 运行迁移
DATABASE_URL=postgresql://devops_user:devops_password@localhost:6432/devops_test bun db:migrate

# 配置 .env.test
TEST_DATABASE_URL=postgresql://devops_user:devops_password@localhost:6432/devops_test
```

### 环境变量

测试优先使用 `.env.test` 中的配置，如果没有则使用 `.env` 中的配置：

```bash
# .env.test（可选）
TEST_DATABASE_URL=postgresql://devops_user:devops_password@localhost:6432/devops
TEST_REDIS_URL=redis://localhost:6379/15
```

## 运行测试

### 基本命令

```bash
# 运行所有测试
bun test

# 监听模式（开发时推荐）
bun test:watch

# 生成覆盖率报告
bun test:coverage

# 使用 UI 界面
bun test:ui
```

### 运行特定测试

```bash
# 运行特定文件
bun test src/modules/auth/auth.service.spec.ts

# 运行匹配模式的测试
bun test --grep "OrganizationsService"

# 运行单个测试用例
bun test --grep "should create organization"
```

## 测试结构

### 项目结构

```
apps/api-clean/
├── src/
│   └── modules/
│       └── auth/
│           ├── auth.service.ts
│           └── auth.service.spec.ts    # 单元测试
├── test/
│   ├── setup.ts                        # 全局测试设置
│   ├── test-database.ts                # 测试数据库配置
│   ├── utils/
│   │   ├── factories.ts                # 测试数据工厂
│   │   ├── db-helpers.ts               # 数据库辅助函数
│   │   ├── auth-helpers.ts             # 认证辅助函数
│   │   └── assertions.ts               # 自定义断言
│   └── integration/                    # 集成测试
│       └── organizations.test.ts
└── vitest.config.ts                    # Vitest 配置
```

### 测试文件命名

- 单元测试：`*.spec.ts`（与源文件同目录）
- 集成测试：`*.test.ts`（在 `test/integration/` 目录）

## 测试工具函数

### 数据工厂 (Factories)

用于生成测试数据：

```typescript
import { userFactory, organizationFactory } from '@test/utils'

// 创建用户数据
const userData = userFactory.build()
const customUser = userFactory.build({ email: 'custom@example.com' })

// 创建组织数据
const orgData = organizationFactory.build()
```

### 数据库辅助函数 (DB Helpers)

用于在测试中操作数据库：

```typescript
import {
  createTestUser,
  createTestOrganization,
  createTestProject,
  clearDatabase,
} from '@test/utils'

// 创建测试用户
const user = await createTestUser()

// 创建测试组织（自动添加用户为 owner）
const org = await createTestOrganization(user.id)

// 创建测试项目
const project = await createTestProject(org.id)

// 清理数据库
await clearDatabase()
```

### 认证辅助函数 (Auth Helpers)

用于模拟认证：

```typescript
import { createTestContext, createMockJWT } from '@test/utils'

// 创建测试上下文（用于 tRPC）
const ctx = await createTestContext()

// 创建模拟 JWT
const token = createMockJWT(user.id)
```

### 自定义断言 (Assertions)

简化常见断言：

```typescript
import {
  expectToBeUUID,
  expectToHaveTimestamps,
  expectNotToBeDeleted,
  expectToBeDeleted,
} from '@test/utils'

// 断言是有效的 UUID
expectToBeUUID(org.id)

// 断言包含时间戳字段
expectToHaveTimestamps(org)

// 断言未被软删除
expectNotToBeDeleted(org)

// 断言已被软删除
expectToBeDeleted(org)
```

## 编写测试

### 单元测试示例

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OrganizationsService } from './organizations.service'
import {
  clearDatabase,
  createTestUser,
  expectToBeUUID,
} from '../../../test/utils'
import { getTestDatabase } from '../../../test/test-database'

describe('OrganizationsService', () => {
  let service: OrganizationsService
  let testUser: any

  beforeEach(async () => {
    const db = getTestDatabase()
    service = new OrganizationsService(db)
    testUser = await createTestUser()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  describe('create', () => {
    it('should create organization and add creator as owner', async () => {
      const orgData = {
        name: 'Test Org',
        slug: 'test-org',
      }

      const org = await service.create(testUser.id, orgData)

      expect(org).toBeDefined()
      expectToBeUUID(org.id)
      expect(org.name).toBe(orgData.name)
    })
  })
})
```

### 集成测试示例

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/trpc/trpc.router'
import { createTestUser, clearDatabase } from '../utils'

describe('Organizations API', () => {
  let testUser: any
  let caller: any

  beforeEach(async () => {
    await clearDatabase()
    testUser = await createTestUser()
    caller = appRouter.createCaller({ user: testUser })
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('should create and list organizations', async () => {
    const org = await caller.organizations.create({
      name: 'Test Org',
      slug: 'test-org',
    })

    expect(org.name).toBe('Test Org')

    const orgs = await caller.organizations.list()
    expect(orgs).toHaveLength(1)
    expect(orgs[0].id).toBe(org.id)
  })
})
```

### Mock 示例

```typescript
import { vi } from 'vitest'

// Mock 数据库
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}

// 配置 mock 返回值
mockDb.select.mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([mockUser]),
  }),
})
```

## 测试覆盖率

### 覆盖率目标

我们的覆盖率目标是 **80%**：

- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

### 查看覆盖率报告

```bash
# 生成覆盖率报告
bun test:coverage

# 报告会生成在 coverage/ 目录
# 打开 coverage/index.html 查看详细报告
```

### 覆盖率配置

在 `vitest.config.ts` 中配置：

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  exclude: [
    'node_modules/',
    'test/',
    '**/*.spec.ts',
    '**/*.test.ts',
  ],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

## 最佳实践

### 1. 测试隔离

每个测试应该独立运行，不依赖其他测试：

```typescript
beforeEach(async () => {
  // 每个测试前清理数据库
  await clearDatabase()
})

afterEach(async () => {
  // 每个测试后清理
  await clearDatabase()
})
```

### 2. 使用描述性的测试名称

```typescript
// ❌ 不好
it('test 1', () => {})

// ✅ 好
it('should create organization and add creator as owner', () => {})
```

### 3. 遵循 AAA 模式

Arrange（准备）、Act（执行）、Assert（断言）：

```typescript
it('should update organization', async () => {
  // Arrange - 准备测试数据
  const org = await createTestOrganization(user.id)

  // Act - 执行操作
  const updated = await service.update(org.id, user.id, {
    name: 'Updated Name',
  })

  // Assert - 验证结果
  expect(updated.name).toBe('Updated Name')
})
```

### 4. 测试边界条件

```typescript
describe('inviteMember', () => {
  it('should invite member successfully', async () => {
    // 正常流程
  })

  it('should throw error if user already member', async () => {
    // 边界条件
  })

  it('should throw error if no permission', async () => {
    // 错误处理
  })
})
```

### 5. 避免过度 Mock

优先使用真实的数据库进行集成测试，只在必要时使用 Mock：

```typescript
// ✅ 好 - 使用真实数据库
const user = await createTestUser()
const org = await service.create(user.id, orgData)

// ⚠️ 谨慎使用 - 只在单元测试中 Mock
const mockDb = { insert: vi.fn() }
```

### 6. 测试异步代码

使用 `async/await`：

```typescript
it('should handle async operations', async () => {
  const result = await service.asyncMethod()
  expect(result).toBeDefined()
})
```

### 7. 测试错误处理

```typescript
it('should throw error on invalid input', async () => {
  await expect(service.create(null, {})).rejects.toThrow('Invalid input')
})
```

## 调试测试

### 使用 console.log

```typescript
it('should debug test', async () => {
  const result = await service.method()
  console.log('Result:', result)
  expect(result).toBeDefined()
})
```

### 使用 Vitest UI

```bash
bun test:ui
```

在浏览器中打开 `http://localhost:51204/__vitest__/` 查看测试结果和调试。

### 只运行特定测试

```typescript
// 只运行这个测试
it.only('should run only this test', () => {})

// 跳过这个测试
it.skip('should skip this test', () => {})
```

## 持续集成

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## 常见问题

### Q: 测试运行很慢怎么办？

A: 使用并行运行和监听模式：

```bash
bun test:watch  # 只运行改变的测试
```

### Q: 如何测试需要认证的端点？

A: 使用 `createTestContext` 创建认证上下文：

```typescript
const ctx = await createTestContext()
const caller = appRouter.createCaller(ctx)
```

### Q: 如何清理测试数据？

A: 在 `afterEach` 中调用 `clearDatabase()`：

```typescript
afterEach(async () => {
  await clearDatabase()
})
```

## 参考资源

- [Vitest 文档](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Drizzle ORM 测试](https://orm.drizzle.team/docs/testing)

## 总结

- 使用 Vitest 进行快速测试
- 利用测试工具函数简化测试编写
- 保持 80% 以上的代码覆盖率
- 遵循测试最佳实践
- 在 CI/CD 中自动运行测试

Happy Testing! 🧪
