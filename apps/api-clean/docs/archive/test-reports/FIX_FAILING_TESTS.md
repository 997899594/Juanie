# 修复失败测试指南

## 当前状态

- ✅ AuthService: 9/9 通过
- ❌ OrganizationsService: 失败
- ❌ ProjectsService: 失败
- 📊 总计: 8/30 通过 (27%)

## 快速修复步骤

### 步骤 1: 确保数据库 Schema 已迁移

```bash
# 运行迁移
cd apps/api-clean
bun db:migrate

# 验证表已创建
psql -U findbiao -d juanie_ai_devops -c "\dt"
```

应该看到以下表：
- users
- oauth_accounts
- organizations
- organization_members
- teams
- team_members
- projects
- project_members
- 等等...

### 步骤 2: 运行单个测试查看详细错误

```bash
# 运行 OrganizationsService 测试（详细模式）
bun test src/modules/organizations/organizations.service.spec.ts --run --reporter=verbose

# 或者只运行一个测试用例
bun test src/modules/organizations/organizations.service.spec.ts --run -t "should create organization"
```

### 步骤 3: 检查常见问题

#### 问题 A: 表不存在

**错误消息**: `relation "users" does not exist`

**解决方案**:
```bash
# 确保迁移已运行
bun db:migrate

# 检查表
psql -U findbiao -d juanie_ai_devops -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
```

#### 问题 B: 数据库连接失败

**错误消息**: `connection refused` 或 `ECONNREFUSED`

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
psql -U findbiao -d juanie_ai_devops -c "SELECT 1"

# 如果失败，启动 PostgreSQL
# macOS (Homebrew):
brew services start postgresql

# 或使用 Docker:
docker-compose up -d postgres
```

#### 问题 C: 权限问题

**错误消息**: `permission denied`

**解决方案**:
```bash
# 授予用户权限
psql -U findbiao -d juanie_ai_devops -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO findbiao"
psql -U findbiao -d juanie_ai_devops -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO findbiao"
```

### 步骤 4: 临时禁用数据清理（调试用）

如果需要查看测试后的数据，临时注释掉清理逻辑：

```typescript
// test/setup.ts
afterEach(async () => {
  // 临时注释掉以查看测试数据
  // await clearDatabase()
  console.log('⚠️ 数据清理已禁用 - 仅用于调试')
})
```

**记住**: 调试完成后要恢复清理逻辑！

### 步骤 5: 添加调试日志

在失败的测试中添加日志：

```typescript
it('should create organization', async () => {
  console.log('🔍 开始测试: 创建组织')
  
  console.log('📝 创建测试用户...')
  const user = await createTestUser()
  console.log('✅ 用户已创建:', user.id)
  
  console.log('📝 创建组织...')
  const orgData = {
    name: 'Test Org',
    slug: 'test-org',
  }
  console.log('📊 组织数据:', orgData)
  
  try {
    const org = await service.create(user.id, orgData)
    console.log('✅ 组织已创建:', org.id)
    expect(org).toBeDefined()
  } catch (error) {
    console.error('❌ 创建组织失败:', error)
    throw error
  }
})
```

## 完整的调试流程

### 1. 运行迁移

```bash
cd apps/api-clean
bun db:migrate
```

### 2. 验证数据库

```bash
# 连接数据库
psql -U findbiao -d juanie_ai_devops

# 列出所有表
\dt

# 检查 users 表结构
\d users

# 退出
\q
```

### 3. 运行测试（详细模式）

```bash
# 运行所有测试
bun test --run --reporter=verbose

# 或只运行失败的测试
bun test src/modules/organizations/organizations.service.spec.ts --run --reporter=verbose
```

### 4. 查看错误并修复

根据错误消息：

- **Schema 错误**: 更新迁移文件
- **数据错误**: 修复测试数据工厂
- **逻辑错误**: 修复服务代码或测试代码

### 5. 重新运行测试

```bash
bun test --run
```

## 如果所有方法都失败

### 选项 1: 重置数据库

```bash
# 删除并重新创建数据库
dropdb juanie_ai_devops
createdb juanie_ai_devops

# 运行迁移
bun db:migrate

# 运行测试
bun test --run
```

### 选项 2: 使用独立的测试数据库

```bash
# 创建测试数据库
createdb juanie_ai_devops_test

# 运行迁移
DATABASE_URL="postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops_test" bun db:migrate

# 更新 .env.test
TEST_DATABASE_URL=postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops_test

# 运行测试
bun test --run
```

### 选项 3: 简化测试

先让简单的测试通过，然后逐步添加复杂的测试：

```typescript
// 最简单的测试
it('should connect to database', async () => {
  const db = getTestDatabase()
  expect(db).toBeDefined()
})

it('should create user', async () => {
  const user = await createTestUser()
  expect(user).toBeDefined()
  expect(user.id).toBeTruthy()
})

// 然后逐步添加更复杂的测试...
```

## 获取帮助

如果问题仍然存在，收集以下信息：

1. **完整的错误消息**
   ```bash
   bun test --run --reporter=verbose > test-error.log 2>&1
   ```

2. **数据库状态**
   ```bash
   psql -U findbiao -d juanie_ai_devops -c "\dt" > db-tables.txt
   ```

3. **环境信息**
   ```bash
   bun --version
   psql --version
   node --version
   ```

4. **测试配置**
   - `.env.test` 内容
   - `vitest.config.ts` 内容

## 预期结果

修复后应该看到：

```
✓ AuthService (9 tests)
✓ OrganizationsService (20+ tests)
✓ ProjectsService (3+ tests)

30+ pass
0 fail
```

## 总结

大多数测试失败是由于：
1. 数据库 Schema 未迁移 (最常见)
2. 数据库连接配置错误
3. 测试数据依赖问题

按照上述步骤操作，应该能解决大部分问题。如果仍有问题，请查看详细的错误日志。

---

**提示**: 测试框架本身是正常的（AuthService 测试全部通过），问题主要在数据库配置和 Schema 上。
