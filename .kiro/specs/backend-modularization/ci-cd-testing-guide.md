# CI/CD 测试指南

## 任务 17.3: 测试 CI/CD 流程

本文档说明如何验证更新后的 CI/CD 配置是否正常工作。

## 本地验证

### 1. 测试 Turborepo 过滤器

```bash
# 查看哪些包会被构建（dry-run）
turbo build --filter='[HEAD^1]' --cache-dir=.turbo --dry-run

# 实际构建变更的包
turbo build --filter='[HEAD^1]' --cache-dir=.turbo

# 验证缓存（第二次运行应该更快）
turbo build --filter='[HEAD^1]' --cache-dir=.turbo
# 应该看到 "cache hit, replaying logs" 消息
```

### 2. 测试其他任务

```bash
# Lint
turbo lint --filter='[HEAD^1]' --cache-dir=.turbo

# Type check
turbo type-check --filter='[HEAD^1]' --cache-dir=.turbo

# Test
turbo test --filter='[HEAD^1]' --cache-dir=.turbo
```

### 3. 检查缓存目录

```bash
# 查看缓存内容
ls -la .turbo/

# 应该看到类似这样的文件：
# - <hash>.tar.zst (缓存的构建输出)
# - <hash>.log (构建日志)
```

## CI 验证步骤

### 场景 1: 提交 CI/CD 配置更改

**目的**: 验证 CI/CD 配置本身是否正确

**步骤**:
1. 提交当前的 CI/CD 配置更改
   ```bash
   git add .github/workflows/ci.yml .gitlab-ci.yml
   git commit -m "chore: update CI/CD to use Turborepo incremental builds"
   git push
   ```

2. 观察 CI 运行
   - GitHub Actions: 访问 Actions 标签页
   - GitLab CI: 访问 CI/CD > Pipelines

3. 验证点：
   - ✅ 所有步骤成功完成
   - ✅ 看到 "Setup Turborepo cache" 步骤
   - ✅ 构建步骤使用 `--filter='[HEAD^1]'`
   - ✅ 缓存被正确保存和恢复

**预期结果**:
- 由于是 CI/CD 配置文件的更改，Turborepo 可能会构建所有包（因为全局依赖变更）
- 但应该看到缓存设置正确

### 场景 2: 只修改一个服务包

**目的**: 验证增量构建是否工作

**步骤**:
1. 创建一个新分支
   ```bash
   git checkout -b test/ci-incremental-build
   ```

2. 只修改一个服务包（例如添加注释）
   ```bash
   echo "// Test comment" >> packages/services/auth/src/auth.service.ts
   git add packages/services/auth/src/auth.service.ts
   git commit -m "test: add comment to auth service"
   git push -u origin test/ci-incremental-build
   ```

3. 创建 Pull Request

4. 观察 CI 运行

**预期结果**:
- ✅ 只构建 `@juanie/service-auth` 和依赖它的包（`@juanie/api-gateway`）
- ✅ 其他包应该被跳过或使用缓存
- ✅ CI 运行时间显著减少（相比构建所有包）

**验证方法**:
查看 CI 日志中的 "Packages in Scope" 部分，应该只列出少数几个包。

### 场景 3: 修改核心包

**目的**: 验证依赖关系是否正确处理

**步骤**:
1. 修改一个核心包
   ```bash
   echo "// Test comment" >> packages/core/database/src/client.ts
   git add packages/core/database/src/client.ts
   git commit -m "test: add comment to database client"
   git push
   ```

2. 观察 CI 运行

**预期结果**:
- ✅ 构建 `@juanie/core-database`
- ✅ 构建所有依赖 `@juanie/core-database` 的包（大部分服务包）
- ✅ 不构建不相关的包（如 `@juanie/web`）

### 场景 4: 无代码变更（重新运行）

**目的**: 验证缓存是否有效

**步骤**:
1. 在 GitHub Actions 或 GitLab CI 中重新运行上一次的 pipeline
2. 观察运行时间

**预期结果**:
- ✅ 大部分任务应该命中缓存
- ✅ 运行时间显著减少（可能从几分钟降到几秒）
- ✅ 日志中显示 "cache hit" 消息

## 监控指标

### 关键指标

1. **CI 运行时间**
   - 基线（构建所有包）: ~5-10 分钟
   - 单包修改: ~1-2 分钟（80-90% 减少）
   - 缓存命中: ~30 秒（95% 减少）

2. **缓存命中率**
   - 目标: > 80%
   - 计算方法: (缓存命中的任务数 / 总任务数) × 100%

3. **构建的包数量**
   - 单包修改: 1-3 个包
   - 核心包修改: 10-20 个包
   - 全局配置修改: 所有包

### 如何查看指标

**GitHub Actions**:
```yaml
# 在 CI 日志中查找：
- "cache hit, replaying logs" - 表示缓存命中
- "Packages in Scope" - 显示将要构建的包
- 总运行时间显示在 Actions 页面
```

**GitLab CI**:
```yaml
# 在 CI 日志中查找：
- "cache hit" - 表示缓存命中
- "Packages in Scope" - 显示将要构建的包
- 总运行时间显示在 Pipeline 页面
```

## 故障排查

### 问题 1: 所有包都被构建

**可能原因**:
- 修改了全局配置文件（`turbo.json`, `package.json`, `tsconfig.json`）
- 修改了 `.env` 文件
- Git history 不足（需要至少 2 个 commits）

**解决方案**:
- 这是预期行为，全局配置变更会影响所有包
- 确保有足够的 git history

### 问题 2: 缓存未命中

**可能原因**:
- 缓存键不匹配
- 缓存已过期
- 首次运行（没有缓存）

**解决方案**:
- 检查 `.turbo` 目录是否被正确缓存
- 第二次运行应该命中缓存

### 问题 3: 过滤器不工作

**可能原因**:
- `[HEAD^1]` 语法在某些 CI 环境中可能不工作
- 需要使用不同的 git ref

**解决方案**:
- 对于 PR: 使用 `--filter='[origin/main...HEAD]'`
- 对于 push: 使用 `--filter='[HEAD^1]'`

### 问题 4: 依赖包未构建

**症状**: 类型错误或导入失败

**原因**: `turbo.json` 中的 `dependsOn` 配置不正确

**解决方案**:
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]  // ^ 表示依赖的包
    }
  }
}
```

## 成功标准

任务 17.3 完成的标准：

- ✅ CI/CD 配置更改已提交并成功运行
- ✅ 单包修改的 CI 运行时间 < 2 分钟
- ✅ 缓存命中率 > 80%
- ✅ 增量构建正确工作（只构建变更的包）
- ✅ 依赖关系正确处理（依赖的包也被构建）
- ✅ 所有测试通过

## 下一步

完成验证后：
1. 合并 CI/CD 配置更改到主分支
2. 更新团队文档，说明新的 CI/CD 流程
3. 监控后续 CI 运行，确保持续优化

## 参考资料

- [Turborepo Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Turborepo Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [GitHub Actions Cache](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [GitLab CI Cache](https://docs.gitlab.com/ee/ci/caching/)
