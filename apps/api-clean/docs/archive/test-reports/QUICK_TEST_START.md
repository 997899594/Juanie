# 快速开始测试

## 1. 确保开发环境运行

```bash
# 启动数据库和 Redis
docker-compose up -d postgres redis
```

## 2. 配置环境变量（可选）

测试会自动使用 `.env` 中的数据库配置。如果你想使用独立的测试数据库，创建 `.env.test`：

```bash
# .env.test（可选）
TEST_DATABASE_URL=postgresql://devops_user:devops_password@localhost:6432/devops
TEST_REDIS_URL=redis://localhost:6379/15
```

**注意**: 测试会在每个测试后清理数据库，请确保使用开发环境而非生产环境。

## 3. 运行测试

```bash
# 运行所有测试
bun test

# 监听模式（推荐开发时使用）
bun test:watch

# 生成覆盖率报告
bun test:coverage

# 使用 UI 界面
bun test:ui
```

## 4. 查看结果

### 终端输出
测试结果会直接显示在终端中。

### 覆盖率报告
运行 `bun test:coverage` 后，打开 `coverage/index.html` 查看详细报告。

### UI 界面
运行 `bun test:ui` 后，在浏览器中打开显示的 URL。

## 5. 编写你的第一个测试

创建文件 `src/modules/your-module/your-service.spec.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { YourService } from './your-service'
import { clearDatabase, createTestUser } from '../../../test/utils'
import { getTestDatabase } from '../../../test/test-database'

describe('YourService', () => {
  let service: YourService
  let testUser: any

  beforeEach(async () => {
    const db = getTestDatabase()
    service = new YourService(db)
    testUser = await createTestUser()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('should work', async () => {
    const result = await service.someMethod()
    expect(result).toBeDefined()
  })
})
```

## 常见问题

### Q: 测试失败，提示数据库连接错误
A: 确保测试数据库已创建并且连接字符串正确。

### Q: 测试运行很慢
A: 使用 `bun test:watch` 只运行改变的测试。

### Q: 如何调试测试
A: 使用 `console.log` 或运行 `bun test:ui` 使用可视化界面。

## 更多信息

查看 [TESTING.md](./TESTING.md) 获取完整的测试指南。
