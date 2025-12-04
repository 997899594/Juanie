# Scripts 目录

工具脚本集合，用于开发、部署、诊断和维护。

## 📋 脚本分类

### 🔧 开发工具
| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `check-queue-jobs.ts` | 检查 BullMQ 队列状态和任务 | 高 |
| `clean-database.ts` | 清理开发数据库数据 | 中 |
| `monitor-progress-events.ts` | 监控项目初始化进度事件 | 高 |
| `watch-gitops-logs.ts` | 实时查看 GitOps 日志 | 高 |

**使用示例**：
```bash
# 检查队列任务
bun run scripts/check-queue-jobs.ts

# 清理数据库（谨慎使用）
bun run scripts/clean-database.ts

# 监控进度事件
bun run scripts/monitor-progress-events.ts
```

### 🚀 部署和配置
| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `setup-k3s-remote.sh` | 配置远程 K3s 集群访问 | 低 |
| `diagnose-gitrepository.sh` | 诊断 Flux GitRepository 问题 | 中 |
| `check-git-repo-structure.sh` | 检查 Git 仓库结构 | 中 |
| `check-flux-remote.sh` | 检查远程 Flux 状态 | 中 |
| `check-kustomization-config.sh` | 检查 Kustomization 配置 | 中 |

**使用示例**：
```bash
# 配置远程 K3s 访问
./scripts/setup-k3s-remote.sh <k3s-host> <k3s-token>

# 诊断 GitRepository
./scripts/diagnose-gitrepository.sh <namespace> <gitrepo-name>

# 检查 Flux 状态
./scripts/check-flux-remote.sh
```

### 📊 分析工具
| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `analyze-services.sh` | 分析服务依赖关系 | 低 |
| `extract-todos.sh` | 提取代码中的 TODO 注释 | 低 |

**使用示例**：
```bash
# 分析服务依赖
./scripts/analyze-services.sh

# 提取 TODO
./scripts/extract-todos.sh > todos.md
```

### 🧹 清理工具
| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `cleanup.sh` | 通用清理脚本（node_modules, dist 等） | 中 |

**使用示例**：
```bash
# 清理构建产物和依赖
./scripts/cleanup.sh
```

## 📦 归档脚本（archive/）

已完成的一次性脚本和迁移脚本已移至 `archive/` 目录：

### 归档内容
- **文档清理脚本**：`aggressive-doc-cleanup.ts`, `cleanup-docs.ts`
- **代码迁移脚本**：`migrate-to-pino-logger.ts`, `restructure-core.sh`
- **修复脚本**：`fix-nestjs-dist.sh`, `fix-oauth.sql`
- **验证脚本**：`verify-architecture.ts`, `verify-git-sync-logs-schema.ts`
- **临时脚本**：`test-pino-logger.ts`, `replace-console-log.ts`

这些脚本保留用于参考，但不再日常使用。

## 🔒 安全注意事项

### 危险操作脚本
以下脚本会修改数据，使用前请确认：
- ⚠️ `clean-database.ts` - 会删除数据库数据
- ⚠️ `cleanup.sh` - 会删除 node_modules 和构建产物

### 最佳实践
1. **备份数据**：运行清理脚本前备份重要数据
2. **测试环境**：先在测试环境验证脚本
3. **权限检查**：确保有足够的权限执行脚本
4. **日志记录**：重要操作记录日志

## 📝 添加新脚本

### 命名规范
- TypeScript 脚本：`kebab-case.ts`
- Shell 脚本：`kebab-case.sh`
- 临时脚本：添加日期后缀，如 `fix-issue-2024-12.ts`

### 脚本模板

**TypeScript 脚本**：
```typescript
#!/usr/bin/env bun
/**
 * 脚本名称
 * 
 * 用途：简要说明脚本功能
 * 使用：bun run scripts/script-name.ts [args]
 */

async function main() {
  // 脚本逻辑
}

main().catch(console.error)
```

**Shell 脚本**：
```bash
#!/bin/bash
# 脚本名称
# 
# 用途：简要说明脚本功能
# 使用：./scripts/script-name.sh [args]

set -e  # 遇到错误立即退出

# 脚本逻辑
```

### 文档要求
新增脚本需要：
1. 在本 README 中添加说明
2. 脚本文件中添加注释
3. 提供使用示例

## 🔗 相关文档

- [开发指南](../docs/guides/quick-start.md)
- [故障排查](../docs/troubleshooting/README.md)
- [项目结构](.kiro/steering/structure.md)

---

**最后更新**: 2024年12月4日  
**维护者**: 项目团队
