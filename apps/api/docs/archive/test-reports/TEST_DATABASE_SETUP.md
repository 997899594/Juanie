# 测试数据库配置说明

## 当前配置

测试使用你的开发数据库：
```
postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops
```

## ⚠️ 重要提示

**测试会在每个测试后清理数据库中的所有数据！**

这意味着：
- ✅ 测试是隔离的，不会相互影响
- ⚠️ 运行测试会删除数据库中的所有现有数据
- 🔒 请确保这是开发环境，不是生产环境

## 运行测试

```bash
# 运行所有测试（会清理数据库）
bun test

# 监听模式（推荐开发时使用）
bun test:watch

# 生成覆盖率报告
bun test:coverage
```

## 数据清理机制

测试框架会在每个测试后自动清理以下表：

1. **CI/CD 相关**: deployment_approvals, deployments, pipeline_runs, pipelines
2. **项目相关**: team_projects, project_members, environments, repositories, projects
3. **团队相关**: team_members, teams
4. **组织相关**: organization_members, organizations
5. **系统表**: notifications, audit_logs, incidents, security_policies, cost_tracking, ai_assistants
6. **用户相关**: oauth_accounts, users

## 如果你想保留开发数据

### 选项1: 创建独立的测试数据库（推荐）

```bash
# 1. 创建测试数据库
createdb juanie_ai_devops_test

# 2. 运行迁移
DATABASE_URL="postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops_test" bun db:migrate

# 3. 更新 .env.test
TEST_DATABASE_URL=postgresql://findbiao:biao1996.@127.0.0.1:5432/juanie_ai_devops_test
```

### 选项2: 在运行测试前备份数据

```bash
# 备份数据库
pg_dump -U findbiao juanie_ai_devops > backup.sql

# 运行测试
bun test

# 恢复数据库（如果需要）
psql -U findbiao juanie_ai_devops < backup.sql
```

### 选项3: 使用 Docker 容器作为测试数据库

```bash
# 启动测试数据库容器
docker run -d \
  --name test-postgres \
  -e POSTGRES_USER=findbiao \
  -e POSTGRES_PASSWORD=biao1996. \
  -e POSTGRES_DB=juanie_ai_devops_test \
  -p 5433:5432 \
  postgres:16-alpine

# 更新 .env.test
TEST_DATABASE_URL=postgresql://findbiao:biao1996.@127.0.0.1:5433/juanie_ai_devops_test

# 运行迁移
DATABASE_URL="postgresql://findbiao:biao1996.@127.0.0.1:5433/juanie_ai_devops_test" bun db:migrate

# 运行测试
bun test

# 停止并删除容器
docker stop test-postgres && docker rm test-postgres
```

## 测试流程

1. **beforeAll**: 初始化测试环境，设置环境变量
2. **beforeEach**: 每个测试前的准备（如果需要）
3. **测试执行**: 运行测试用例
4. **afterEach**: 清理数据库（TRUNCATE 所有表）
5. **afterAll**: 关闭数据库连接

## 常见问题

### Q: 测试失败，提示数据库连接错误
A: 确保数据库正在运行，并且连接信息正确。

### Q: 测试运行后我的开发数据不见了
A: 这是预期行为。测试会清理数据库。请使用独立的测试数据库或在测试前备份数据。

### Q: 如何跳过数据库清理
A: 不建议跳过清理，因为这会导致测试不隔离。如果确实需要，可以注释掉 `test/setup.ts` 中的 `afterEach` 清理逻辑。

### Q: 测试很慢
A: 使用 `bun test:watch` 只运行改变的测试，或者使用内存数据库（需要额外配置）。

## 最佳实践

1. ✅ 使用独立的测试数据库
2. ✅ 在 CI/CD 中使用临时数据库
3. ✅ 定期备份开发数据
4. ❌ 不要在生产数据库上运行测试
5. ❌ 不要依赖测试之间的数据

## 下一步

查看 [TESTING.md](./TESTING.md) 获取完整的测试指南。
