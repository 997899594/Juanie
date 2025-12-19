# 前端错误汇总与修复方案

## 错误统计

总计：239 个错误，分布在 64 个文件中

## 错误分类

### 1. API 路由不存在（高优先级）
这些是后端重构后删除或重命名的 API：

- `users.oauthAccounts.*` → 应改为 `users.gitConnections.*` ✅ 已修复
- `gitops.previewChanges` → 需要确认是否存在
- `gitops.validateYAML` → 需要确认是否存在
- `gitSync.getOAuthUrl` → 需要确认是否存在
- `gitSync.checkCredentialHealth` → 需要确认是否存在
- `gitSync.getProjectSyncLogs` → 需要确认是否存在
- `gitSync.syncProjectMembers` → 需要确认是否存在
- `gitSync.retrySyncTask` → 需要确认是否存在
- `projects.getById` → 应改为 `projects.get`

### 2. 类型定义缺失（高优先级）
- `@juanie/types` 中缺少的类型：
  - `AiAssistant` → 需要添加
  - `GitOpsResource` → 需要添加
  - `Notification` → 需要添加
  - `FluxHealth` → 需要添加

### 3. 参数类型不匹配（中优先级）
- Git 连接相关的参数结构变化
- 环境管理相关的参数结构变化
- 项目创建相关的参数结构变化

### 4. 未使用的导入和变量（低优先级）
- 大量 `TS6133` 警告
- 不影响功能，但影响代码质量

### 5. 第三方库类型问题（低优先级）
- `@grafana/faro-web-sdk` 类型定义问题
- 可以暂时忽略或使用 `@ts-ignore`

## 修复策略

### 阶段 1：修复阻塞性错误（P0）
1. 确认后端 API 路由
2. 添加缺失的类型定义
3. 修复 API 调用

### 阶段 2：修复功能性错误（P1）
1. 更新 Composables
2. 更新 Components
3. 更新 Views

### 阶段 3：代码质量优化（P2）
1. 清理未使用的导入
2. 清理未使用的变量
3. 优化类型推断

## 需要确认的后端 API

让我检查这些 API 是否存在于后端：

1. GitOps 相关：
   - `previewChanges`
   - `validateYAML`

2. GitSync 相关：
   - `getOAuthUrl`
   - `checkCredentialHealth`
   - `getProjectSyncLogs`
   - `syncProjectMembers`
   - `retrySyncTask`

3. Projects 相关：
   - `getById` vs `get`

4. Credentials 相关：
   - `createGitHubAppCredential`
   - `createGitLabGroupTokenCredential`
   - `createPATCredential`
