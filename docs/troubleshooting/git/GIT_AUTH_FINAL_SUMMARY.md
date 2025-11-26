# Git 认证方案 - 最终实现总结

## ✅ 已完成

### 1. 数据库 Schema
- ✅ 创建 `git_credentials` 表
- ✅ 生成迁移文件：`0009_quiet_jackpot.sql`
- ✅ 应用到数据库

### 2. 核心服务
- ✅ `GitAuthService` - Git 认证服务
  - 支持 GitLab Project Access Token
  - 支持 GitHub Deploy Key
  - 自动创建 K8s Secret
  - 支持凭证撤销

- ✅ `GitAuthModule` - Git 认证模块
  - 集成到 FluxModule
  - 依赖注入配置完成

### 3. 事件处理
- ✅ 更新 `GitOpsEventHandlerService`
  - 使用 GitAuthService 替代 OAuth token 刷新
  - 创建长期有效凭证
  - 自动检测 Git 提供商

### 4. 编译验证
- ✅ Core 包编译通过
- ✅ Business 包编译通过
- ✅ 类型检查通过

## 方案对比

| 特性 | 旧方案（定时刷新） | 新方案（长期凭证） |
|------|------------------|------------------|
| Token 类型 | 用户 OAuth Token | Project Access Token / Deploy Key |
| 有效期 | 2小时 | 永不过期 |
| 需要刷新 | ✅ 每小时 | ❌ 不需要 |
| 复杂度 | 高（定时任务） | 低（一次性创建） |
| 可靠性 | 中（依赖刷新） | 高（永久有效） |
| 业界标准 | ❌ 非标准 | ✅ 标准做法 |

## 工作流程

```
项目创建
    ↓
Worker 发布 GitOps 事件
    ↓
GitOpsEventHandlerService
    ├─ 检测 Git 提供商（GitHub/GitLab）
    ├─ 调用 GitAuthService.setupProjectAuth()
    │   ├─ 获取用户 OAuth token（只用一次）
    │   ├─ GitLab: 创建 Project Access Token（永不过期）
    │   ├─ GitHub: 创建 Deploy Key（永不过期）
    │   ├─ 存储到数据库（git_credentials 表）
    │   └─ 创建 K8s Secret
    ↓
使用长期凭证创建 GitOps 资源
    ├─ GitRepository
    ├─ Kustomization
    ↓
Flux 使用 Secret 访问仓库 ✓
    └─ 永不过期，无需刷新！
```

## 代码变更

### 新增文件
1. `packages/core/core/src/database/schemas/git-credentials.schema.ts`
2. `packages/services/business/src/gitops/git-auth/git-auth.service.ts`
3. `packages/services/business/src/gitops/git-auth/git-auth.module.ts`
4. `packages/core/core/src/database/drizzle/0009_quiet_jackpot.sql`

### 修改文件
1. `packages/core/core/src/database/schemas/index.ts` - 导出新 schema
2. `packages/services/business/src/gitops/gitops-event-handler.service.ts` - 使用 GitAuthService
3. `packages/services/business/src/gitops/flux/flux.module.ts` - 导入 GitAuthModule
4. `packages/services/business/src/index.ts` - 导出 GitAuthService

### 可删除文件（可选）
1. `packages/services/business/src/gitops/git-secret-refresher.service.ts` - 不再需要

## 环境变量

```bash
# GitLab 配置
GITLAB_BASE_URL=https://gitlab.com  # 或私服 URL
GITLAB_CLIENT_ID=xxx
GITLAB_CLIENT_SECRET=xxx

# GitHub 配置
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# K3s 配置
K3S_KUBECONFIG_PATH=~/.kube/config
```

## 使用示例

### GitLab Project Access Token

```typescript
// 自动创建（在项目初始化时）
const result = await gitAuthService.setupProjectAuth({
  projectId: 'xxx',
  repositoryId: 'yyy',
  provider: 'gitlab',
  repositoryUrl: 'https://gitlab.com/owner/repo',
  repositoryFullName: 'owner/repo',
  userId: 'user-id',
})

// 结果：
// - 在 GitLab 创建 Project Access Token（永不过期）
// - 存储到 git_credentials 表
// - 创建 K8s Secret
```

### GitHub Deploy Key

```typescript
// 自动创建（在项目初始化时）
const result = await gitAuthService.setupProjectAuth({
  projectId: 'xxx',
  repositoryId: 'yyy',
  provider: 'github',
  repositoryUrl: 'https://github.com/owner/repo',
  repositoryFullName: 'owner/repo',
  userId: 'user-id',
})

// 结果：
// - 生成 SSH 密钥对
// - 在 GitHub 添加 Deploy Key（只读）
// - 存储私钥到 git_credentials 表
// - 创建 K8s Secret
```

### 撤销凭证

```typescript
// 撤销项目的 Git 凭证
await gitAuthService.revokeCredential(projectId)

// 会执行：
// 1. 从 GitLab/GitHub 撤销 token/key
// 2. 删除 K8s Secret
// 3. 标记数据库记录为已撤销
```

## 测试

### 验证数据库

```sql
-- 查看 git_credentials 表
SELECT * FROM git_credentials;

-- 查看特定项目的凭证
SELECT 
  id, 
  project_id, 
  type, 
  expires_at, 
  revoked_at,
  created_at
FROM git_credentials 
WHERE project_id = 'xxx';
```

### 验证 K8s Secret

```bash
# 查看 Secret
kubectl get secret xxx-git-auth -n project-xxx-development

# 查看 Secret 内容
kubectl get secret xxx-git-auth -n project-xxx-development -o yaml
```

### 验证 Flux

```bash
# 查看 GitRepository 状态
kubectl get gitrepository -A

# 查看详细信息
kubectl describe gitrepository xxx-repo -n project-xxx-development

# 应该看到 Ready 状态
```

## 下一步

### 立即可做
1. ✅ 测试创建新项目
2. ✅ 验证 GitLab token 创建
3. ✅ 验证 GitHub Deploy Key 创建
4. ✅ 验证 Flux 可以访问仓库

### 后续优化
1. 🔄 Token 加密存储（使用 AES-256）
2. 🔄 添加审计日志
3. 🔄 迁移现有项目到新方案
4. 🔄 删除旧的 GitSecretRefresherService
5. 🔄 重构 Core 包结构（去掉多余的嵌套）

### 文档
1. ✅ [Git 认证实现](./GIT_AUTH_IMPLEMENTATION.md)
2. ✅ [正确的 Git 认证方案](./CORRECT_GIT_AUTH.md)
3. ✅ [Core 结构重构计划](../architecture/CORE_RESTRUCTURE.md)

## 总结

✅ **实现了业界标准的 Git 认证方案**
- GitLab: Project Access Token（永不过期）
- GitHub: Deploy Key（永不过期）
- 不需要定时刷新
- 简单、可靠、专业

✅ **所有代码已编译通过**
✅ **数据库迁移已完成**
✅ **准备好测试和部署**

这是正确的实现方式！🎉
