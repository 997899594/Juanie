# 前端 API 映射表

## Git 连接相关

### ✅ 已存在的 API
- `users.gitConnections.list` - 获取 Git 连接列表
- `users.gitConnections.link` - 关联 Git 连接（通过 OAuth）
- `users.gitConnections.unlink` - 取消关联
- `gitSync.linkGitAccount` - 手动关联 Git 账号
- `gitSync.getGitAccountStatus` - 获取 Git 账号状态
- `gitSync.unlinkGitAccount` - 取消关联 Git 账号
- `gitSync.getSyncLogs` - 获取同步日志
- `gitSync.getFailedSyncs` - 获取失败的同步任务
- `gitSync.retrySyncMember` - 重试同步成员
- `gitSync.retryFailedSyncs` - 批量重试失败的同步任务
- `gitSync.getConflictHistory` - 获取冲突历史

### ❌ 不存在的 API（需要删除或替换）
- `gitSync.getOAuthUrl` → 使用 `auth.oauthCallback` 流程
- `gitSync.checkCredentialHealth` → 使用 `gitSync.getGitAccountStatus`
- `gitSync.getProjectSyncLogs` → 使用 `gitSync.getSyncLogs`
- `gitSync.syncProjectMembers` → 功能已集成到后端自动同步
- `gitSync.retrySyncTask` → 使用 `gitSync.retrySyncMember`

## 项目相关

### ✅ 已存在的 API
- `projects.create` - 创建项目
- `projects.list` - 列出项目
- `projects.get` - 获取项目详情
- `projects.update` - 更新项目
- `projects.delete` - 删除项目
- `projects.getStatus` - 获取项目状态
- `projects.getHealth` - 获取项目健康度
- `projects.onInitProgress` - 订阅初始化进度

### ❌ 不存在的 API
- `projects.getById` → 使用 `projects.get`

## GitOps 相关

### ✅ 已存在的 API
- `gitops.getProjectGitOpsStatus` - 获取项目 GitOps 状态
- `gitops.listResources` - 列出 GitOps 资源
- `gitops.getResource` - 获取单个资源
- `gitops.createResource` - 创建资源
- `gitops.updateResource` - 更新资源
- `gitops.deleteResource` - 删除资源
- `gitops.syncResource` - 同步资源
- `gitops.getResourceLogs` - 获取资源日志

### ❌ 不存在的 API
- `gitops.previewChanges` → 功能未实现，需要删除相关代码
- `gitops.validateYAML` → 功能未实现，需要删除相关代码

## 凭证管理相关

### ❌ 不存在的 API（已废弃）
- `createGitHubAppCredential` → 使用 OAuth 流程
- `createGitLabGroupTokenCredential` → 使用 OAuth 流程
- `createPATCredential` → 使用 OAuth 流程

这些凭证管理 API 已被统一的 OAuth 流程替代，通过 `auth.oauthCallback` 处理。

## 环境管理相关

### ✅ 已存在的 API
- `environments.create` - 创建环境
- `environments.list` - 列出环境
- `environments.get` - 获取环境详情
- `environments.update` - 更新环境
- `environments.delete` - 删除环境

## 修复建议

1. **删除废弃的 API 调用**：
   - 删除所有对 `getOAuthUrl`、`checkCredentialHealth` 等不存在 API 的调用
   - 删除凭证管理相关的表单组件

2. **替换 API 调用**：
   - `projects.getById` → `projects.get`
   - `gitSync.getProjectSyncLogs` → `gitSync.getSyncLogs`
   - `gitSync.retrySyncTask` → `gitSync.retrySyncMember`

3. **简化 OAuth 流程**：
   - 使用统一的 `auth.oauthCallback` 处理所有 OAuth 回调
   - 删除手动凭证管理的 UI

4. **删除未实现的功能**：
   - 删除 GitOps 配置预览和 YAML 验证相关的 UI
   - 或者在后端实现这些功能
