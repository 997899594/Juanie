# 前端重构计划 - 适配后端数据库重构

## 背景

后端完成了数据库重构，统一了命名规范和数据结构。前端需要同步更新以适配新的 API 接口。

## 主要变更

### 1. Git 账户管理
- ❌ 旧：`users.oauthAccounts.*`
- ✅ 新：`users.gitConnections.*`

### 2. 字段命名统一
- ❌ `gitCommitSha` → ✅ `commitHash`
- ❌ `gitSyncStatus` → ✅ `status`
- ❌ `syncStatus` → ✅ `status`
- ❌ `fluxSyncStatus` → ✅ 已删除

### 3. 删除的字段
- `projects.initializationStatus` - 使用 `project_initialization_steps` 表
- `deployments.gitCommitSha` - 使用 `commitHash`
- `repositories.fluxSyncStatus` - 使用 `status`

## 修复优先级

### P0 - 阻塞性错误（必须立即修复）
1. ✅ Git 连接 API 更新（已完成）
2. ✅ 字段名称统一（已完成）
3. 🔄 缺失的 tRPC 路由
4. 🔄 类型定义更新

### P1 - 功能性错误（影响功能）
1. 🔄 Composables 中的 API 调用
2. 🔄 组件中的数据绑定
3. 🔄 表单验证和提交

### P2 - 代码质量（不影响功能）
1. 未使用的导入
2. 未使用的变量
3. 类型推断优化

## 需要修复的文件

### Composables (核心逻辑)
- [ ] `src/composables/useGitSync.ts` - Git 同步相关
- [ ] `src/composables/useGitOps.ts` - GitOps 相关
- [ ] `src/composables/useEnvironments.ts` - 环境管理
- [ ] `src/composables/useAIAssistants.ts` - AI 助手
- [ ] `src/composables/useNotifications.ts` - 通知
- [ ] `src/composables/projects/*` - 项目相关

### Components (UI 组件)
- [ ] `src/components/GitAccountLinking.vue` - Git 账户连接
- [ ] `src/components/GitSyncStatus.vue` - Git 同步状态
- [ ] `src/components/GitAuthStatus.vue` - Git 认证状态
- [ ] `src/components/auth-forms/*.vue` - 认证表单
- [ ] `src/components/EnvironmentsTab.vue` - 环境标签页
- [ ] `src/components/GitOpsDeployDialog.vue` - GitOps 部署对话框

### Views (页面)
- [ ] `src/views/auth/GitCallback.vue` - Git 回调
- [ ] `src/views/repositories/Repositories.vue` - 仓库列表
- [ ] `src/views/Environments.vue` - 环境管理
- [ ] `src/views/gitops/GitOpsResources.vue` - GitOps 资源

## 修复策略

1. **先修复 tRPC 路由定义** - 确保后端接口正确暴露
2. **更新类型定义** - 确保前端类型与后端一致
3. **修复 Composables** - 核心业务逻辑
4. **修复 Components** - UI 组件
5. **修复 Views** - 页面级组件
6. **清理未使用代码** - 提升代码质量

## 注意事项

- 遵循"绝不向后兼容"原则，直接替换旧代码
- 所有 API 调用必须使用新的接口
- 删除所有对已废弃字段的引用
- 确保类型安全，避免使用 `any`
