# CI/CD 更新说明

## 概述

已更新 GitHub Actions 和 GitLab CI 配置，以充分利用 Turborepo 的缓存和增量构建功能。

## 主要改进

### 1. 增量构建和测试

**之前**: 构建所有服务包和核心包
```yaml
turbo build --filter='@juanie/service-*' --filter='@juanie/core-*'
```

**现在**: 只构建变更的包及其依赖
```yaml
turbo build --filter='[HEAD^1]' --cache-dir=.turbo
```

### 2. Turborepo 缓存优化

**GitHub Actions**:
- 使用 `actions/cache@v4` 缓存 `.turbo` 目录
- 所有 turbo 命令使用 `--cache-dir=.turbo` 参数
- 缓存键基于 commit SHA，回退到分支缓存

**GitLab CI**:
- 缓存 `.turbo` 目录和 `node_modules`
- 缓存键基于分支名称
- 自动在 pipeline 运行之间共享缓存

### 3. 过滤器说明

`--filter='[HEAD^1]'` 表示:
- 只处理自上次 commit 以来变更的包
- 自动包含这些包的依赖者（dependents）
- 大幅减少 CI 运行时间

## 性能提升预期

### 场景 1: 只修改一个服务包
- **之前**: 构建所有包 (~60s) + 测试所有包 (~120s) = 180s
- **现在**: 构建 1 个包 (~5s) + 测试 1 个包 (~10s) = 15s
- **提升**: 92% 时间节省

### 场景 2: 修改核心包
- **之前**: 构建所有包 (~60s) + 测试所有包 (~120s) = 180s
- **现在**: 构建核心包 + 依赖它的包 (~30s) + 测试 (~60s) = 90s
- **提升**: 50% 时间节省

### 场景 3: 无代码变更（重新运行）
- **之前**: 完整构建和测试 (~180s)
- **现在**: 全部命中缓存 (~5s)
- **提升**: 97% 时间节省

## 配置详情

### GitHub Actions (.github/workflows/ci.yml)

```yaml
# 设置 Turborepo 缓存
- name: Setup Turborepo cache
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-

# 只构建变更的包
- name: Build packages
  run: turbo build --filter='[HEAD^1]' --cache-dir=.turbo

# 只检查变更的包
- name: Run linter
  run: turbo lint --filter='[HEAD^1]' --cache-dir=.turbo

- name: Run type check
  run: turbo type-check --filter='[HEAD^1]' --cache-dir=.turbo

# 只测试变更的包
- name: Run tests
  run: turbo test --filter='[HEAD^1]' --cache-dir=.turbo
```

### GitLab CI (.gitlab-ci.yml)

```yaml
# 缓存配置
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - .turbo
    - node_modules/
    - packages/*/node_modules/
    - apps/*/node_modules/

# 只构建和测试变更的包
script:
  - turbo build --filter='[HEAD^1]' --cache-dir=.turbo
  - turbo lint --filter='[HEAD^1]' --cache-dir=.turbo
  - turbo type-check --filter='[HEAD^1]' --cache-dir=.turbo
  - turbo test --filter='[HEAD^1]' --cache-dir=.turbo
```

## 验证步骤

### 1. 本地测试

```bash
# 模拟 CI 环境
export TURBO_CACHE_DIR=.turbo

# 测试增量构建
turbo build --filter='[HEAD^1]' --cache-dir=.turbo

# 测试缓存命中
turbo build --filter='[HEAD^1]' --cache-dir=.turbo
# 应该看到 "cache hit" 消息
```

### 2. CI 测试

1. 创建一个只修改单个包的 PR
2. 观察 CI 日志，确认只构建了变更的包
3. 重新运行 CI，确认缓存生效

### 3. 监控指标

- CI 运行时间（应该显著减少）
- 缓存命中率（应该 > 80%）
- 构建的包数量（应该 < 总包数）

## 故障排查

### 问题 1: 缓存未命中

**症状**: 每次都完整构建

**解决方案**:
- 检查 `.turbo` 目录是否被正确缓存
- 检查 `turbo.json` 中的 `inputs` 配置
- 确保 `--cache-dir=.turbo` 参数存在

### 问题 2: 过滤器不工作

**症状**: 构建了所有包

**解决方案**:
- 检查 git history（需要至少 2 个 commits）
- 在 PR 中使用 `--filter='[origin/main...HEAD]'`
- 检查 `turbo.json` 中的 `dependsOn` 配置

### 问题 3: 依赖包未构建

**症状**: 类型错误或导入失败

**解决方案**:
- Turborepo 会自动构建依赖，检查 `turbo.json` 中的 `dependsOn: ["^build"]`
- 确保包的 `package.json` 中正确声明了依赖

## 下一步优化

1. **远程缓存**: 配置 Turborepo Remote Cache（Vercel 或自托管）
2. **并行度**: 调整 `--concurrency` 参数
3. **选择性测试**: 为不同类型的变更配置不同的测试策略
4. **Docker 层缓存**: 优化 Docker 构建缓存

## 参考资料

- [Turborepo Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Turborepo Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [GitHub Actions Cache](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [GitLab CI Cache](https://docs.gitlab.com/ee/ci/caching/)
