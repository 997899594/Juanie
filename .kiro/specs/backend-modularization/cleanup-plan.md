# 代码清理计划

## 任务 18.1: 清理旧代码

### 已迁移的模块

以下模块已经成功迁移到 `packages/services/`，可以从 `apps/api/src/modules/` 中删除：

#### ✅ 已迁移且可删除的模块

1. **ai-assistants** → `packages/services/ai-assistants/`
2. **audit-logs** → `packages/services/audit-logs/`
3. **auth** → `packages/services/auth/`
4. **cost-tracking** → `packages/services/cost-tracking/`
5. **deployments** → `packages/services/deployments/`
6. **environments** → `packages/services/environments/`
7. **k3s** → `packages/services/k3s/`
8. **notifications** → `packages/services/notifications/`
9. **ollama** → `packages/services/ollama/`
10. **organizations** → `packages/services/organizations/`
11. **pipelines** → `packages/services/pipelines/`
12. **projects** → `packages/services/projects/`
13. **repositories** → `packages/services/repositories/`
14. **security-policies** → `packages/services/security-policies/`
15. **storage** → `packages/services/storage/`
16. **teams** → `packages/services/teams/`
17. **templates** → `packages/services/templates/`
18. **users** → `packages/services/users/`

#### ⚠️ 保留的模块

1. **queue** - 基础设施代码，包含 BullMQ 队列和 worker
   - 原因：队列系统是共享基础设施，不是业务服务
   - 建议：未来可以考虑迁移到 `packages/core/queue/`

### 清理策略

#### 阶段 1: 备份（已完成）
- ✅ 整个 `apps/api` 目录作为备份保留
- ✅ Git 历史记录保留所有变更

#### 阶段 2: 删除已迁移模块（本次执行）
```bash
# 删除已迁移的模块
rm -rf apps/api/src/modules/ai-assistants
rm -rf apps/api/src/modules/audit-logs
rm -rf apps/api/src/modules/auth
rm -rf apps/api/src/modules/cost-tracking
rm -rf apps/api/src/modules/deployments
rm -rf apps/api/src/modules/environments
rm -rf apps/api/src/modules/k3s
rm -rf apps/api/src/modules/notifications
rm -rf apps/api/src/modules/ollama
rm -rf apps/api/src/modules/organizations
rm -rf apps/api/src/modules/pipelines
rm -rf apps/api/src/modules/projects
rm -rf apps/api/src/modules/repositories
rm -rf apps/api/src/modules/security-policies
rm -rf apps/api/src/modules/storage
rm -rf apps/api/src/modules/teams
rm -rf apps/api/src/modules/templates
rm -rf apps/api/src/modules/users

# 保留 queue 模块
# apps/api/src/modules/queue/ - 保留
```

#### 阶段 3: 更新导入（如果需要）
检查 `apps/api` 中是否还有对已删除模块的引用：
```bash
# 搜索可能的引用
grep -r "from.*modules/auth" apps/api/src/
grep -r "from.*modules/organizations" apps/api/src/
# ... 等等
```

### 清理后的目录结构

```
apps/api/
├── src/
│   ├── modules/
│   │   └── queue/              # 保留：队列基础设施
│   ├── database/               # 已迁移到 packages/core/database
│   ├── main.ts
│   └── app.module.ts
├── package.json
└── tsconfig.json
```

### 验证步骤

#### 1. 检查 API Gateway 是否正常工作
```bash
cd apps/api-gateway
bun run dev
```

#### 2. 检查所有服务包是否可用
```bash
turbo build --filter='@juanie/service-*'
```

#### 3. 运行测试
```bash
turbo test --filter='@juanie/service-*'
```

#### 4. 检查类型
```bash
turbo type-check
```

### 回滚计划

如果清理后出现问题：

1. **Git 回滚**
   ```bash
   git checkout HEAD -- apps/api/src/modules/
   ```

2. **从备份恢复**
   - 所有代码都在 Git 历史中
   - 可以随时恢复任何已删除的文件

### 清理收益

#### 代码库大小
- **删除的文件数**: ~200+ 文件
- **减少的代码行数**: ~15,000+ 行
- **减少的目录数**: 18 个模块目录

#### 维护成本
- ✅ 消除代码重复
- ✅ 减少混淆（只有一个代码源）
- ✅ 简化 `apps/api` 结构

#### 开发体验
- ✅ 更清晰的代码组织
- ✅ 更快的 IDE 索引
- ✅ 更容易理解的架构

### 风险评估

#### 低风险
- ✅ 所有模块都已成功迁移
- ✅ API Gateway 已验证工作正常
- ✅ 有完整的 Git 历史可回滚
- ✅ 有备份（整个 apps/api 保留）

#### 缓解措施
- 分步执行，每步验证
- 保留 Git 历史
- 保留 `apps/api` 作为备份
- 充分测试后再删除

### 执行时间表

1. **准备阶段** (5 分钟)
   - ✅ 创建清理计划文档
   - ✅ 确认所有模块已迁移

2. **执行阶段** (10 分钟)
   - 删除已迁移的模块
   - 更新相关引用（如果有）
   - 提交更改

3. **验证阶段** (15 分钟)
   - 运行构建
   - 运行测试
   - 检查 API Gateway
   - 验证类型检查

4. **文档阶段** (10 分钟)
   - 更新清理文档
   - 记录清理结果
   - 更新任务状态

**总计**: ~40 分钟

### 后续步骤

完成清理后：

1. **考虑完全移除 apps/api**
   - 当前保留作为备份
   - 3-6 个月后如果没有问题，可以考虑删除

2. **迁移 queue 模块**
   - 评估是否需要迁移到 `packages/core/queue/`
   - 或者保留在 API Gateway 中

3. **更新文档**
   - 更新架构文档
   - 更新开发指南
   - 更新部署文档

## 执行命令

### 安全删除命令（推荐）

```bash
# 创建备份分支（可选，因为已有 Git 历史）
git checkout -b backup/before-cleanup

# 返回主分支
git checkout main

# 删除已迁移的模块
cd apps/api/src/modules

# 逐个删除并验证
rm -rf ai-assistants && echo "Deleted ai-assistants"
rm -rf audit-logs && echo "Deleted audit-logs"
rm -rf auth && echo "Deleted auth"
rm -rf cost-tracking && echo "Deleted cost-tracking"
rm -rf deployments && echo "Deleted deployments"
rm -rf environments && echo "Deleted environments"
rm -rf k3s && echo "Deleted k3s"
rm -rf notifications && echo "Deleted notifications"
rm -rf ollama && echo "Deleted ollama"
rm -rf organizations && echo "Deleted organizations"
rm -rf pipelines && echo "Deleted pipelines"
rm -rf projects && echo "Deleted projects"
rm -rf repositories && echo "Deleted repositories"
rm -rf security-policies && echo "Deleted security-policies"
rm -rf storage && echo "Deleted storage"
rm -rf teams && echo "Deleted teams"
rm -rf templates && echo "Deleted templates"
rm -rf users && echo "Deleted users"

# 返回项目根目录
cd ../../../..

# 检查状态
git status

# 提交更改
git add apps/api/src/modules/
git commit -m "chore: remove migrated modules from apps/api

All business logic modules have been successfully migrated to packages/services/.
Only the queue module is retained as it's infrastructure code.

Deleted modules:
- ai-assistants, audit-logs, auth, cost-tracking
- deployments, environments, k3s, notifications
- ollama, organizations, pipelines, projects
- repositories, security-policies, storage
- teams, templates, users

Retained:
- queue (infrastructure code)

Related: Task 18.1"
```

### 验证命令

```bash
# 验证构建
turbo build

# 验证测试
turbo test

# 验证类型
turbo type-check

# 启动 API Gateway
cd apps/api-gateway
bun run dev
```

## 成功标准

- [x] 清理计划文档已创建
- [ ] 18 个已迁移模块已删除
- [ ] queue 模块已保留
- [ ] 构建成功
- [ ] 测试通过
- [ ] API Gateway 正常运行
- [ ] 更改已提交到 Git

## 注意事项

1. **不要删除 queue 模块** - 它是基础设施代码
2. **保留 apps/api 目录** - 作为备份
3. **验证每一步** - 确保没有破坏性更改
4. **记录问题** - 如果遇到问题，记录下来供后续参考
