# 前端重构 - 需要决策

## 当前状况

前端有 **239 个 TypeScript 错误**，主要原因是后端重构后删除或重命名了很多 API。

## 需要您决策的问题

### 1. 凭证管理功能（已废弃）

**受影响的文件**：
- `src/components/auth-forms/GitHubAppAuthForm.vue`
- `src/components/auth-forms/GitLabGroupAuthForm.vue`
- `src/components/auth-forms/PATAuthForm.vue`

**问题**：这些组件调用的 API 不存在：
- `createGitHubAppCredential`
- `createGitLabGroupTokenCredential`
- `createPATCredential`

**选项**：
- **A. 删除这些组件**（推荐）- 因为现在统一使用 OAuth 流程
- **B. 在后端实现这些 API** - 如果还需要支持手动凭证管理

### 2. GitOps 配置预览和验证功能（未实现）

**受影响的文件**：
- `src/components/GitOpsDeployDialog.vue`

**问题**：调用的 API 不存在：
- `gitops.previewChanges`
- `gitops.validateYAML`

**选项**：
- **A. 删除这些功能**（临时方案）- 先让系统能运行
- **B. 在后端实现这些 API**（推荐）- 这些是有用的功能

### 3. Git 同步相关功能（部分废弃）

**受影响的文件**：
- `src/composables/useGitSync.ts`
- `src/components/GitAccountLinking.vue`
- `src/components/GitSyncStatus.vue`

**问题**：调用的 API 不存在或已重命名：
- `getOAuthUrl` → 应使用 `auth.oauthCallback` 流程
- `checkCredentialHealth` → 应使用 `gitSync.getGitAccountStatus`
- `syncProjectMembers` → 功能已集成到后端自动同步

**选项**：
- **A. 更新前端代码使用新 API**（推荐）
- **B. 在后端添加兼容层** - 不推荐，违反"绝不向后兼容"原则

## 我的建议

### 立即执行（不需要决策）

1. ✅ 修复字段名称（已完成）
   - `gitCommitSha` → `commitHash`
   - `gitSyncStatus` → `status`

2. 🔄 修复 API 调用路径
   - `users.oauthAccounts.*` → `users.gitConnections.*`
   - `projects.getById` → `projects.get`

3. 🔄 更新类型定义
   - 添加缺失的类型到 `@juanie/types`

### 需要您决策

**方案 A：快速修复（推荐）**
- 删除所有废弃的功能和组件
- 更新现有代码使用新 API
- 预计修复时间：2-3 小时
- 优点：快速让系统运行起来
- 缺点：部分功能暂时不可用

**方案 B：完整实现**
- 在后端实现所有缺失的 API
- 更新前端代码
- 预计修复时间：1-2 天
- 优点：保留所有功能
- 缺点：需要更多时间

## 建议的执行顺序

如果选择**方案 A**：

1. **阶段 1：核心修复**（30分钟）
   - 修复 `useGitSync.ts` - 使用新 API
   - 修复 `useGitOps.ts` - 删除不存在的 API 调用
   - 修复 `useEnvironments.ts` - 更新 API 调用

2. **阶段 2：组件修复**（1小时）
   - 删除废弃的认证表单组件
   - 更新 Git 账户连接组件
   - 更新 GitOps 相关组件

3. **阶段 3：页面修复**（1小时）
   - 更新所有页面组件
   - 测试核心功能

4. **阶段 4：代码清理**（30分钟）
   - 删除未使用的导入
   - 删除未使用的变量

## 您的决定？

请告诉我您希望采用哪个方案，我会立即开始执行。

**推荐：方案 A（快速修复）**，因为：
1. 遵循"绝不向后兼容"原则
2. 快速让系统运行起来
3. 后续可以根据需要逐步添加功能
