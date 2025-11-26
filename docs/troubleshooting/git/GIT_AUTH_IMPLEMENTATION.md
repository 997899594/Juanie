# Git 认证实现 - 使用长期凭证

## 概述

实现了业界标准的 Git 认证方案，使用长期有效的凭证替代短期 OAuth Token。

## 方案对比

### ❌ 旧方案（已废弃）
```
用户 OAuth Token (2小时过期)
  → 定时刷新 (每小时)
  → 更新 K8s Secret
  → 复杂、不可靠
```

### ✅ 新方案（已实现）
```
用户 OAuth Token (只用一次)
  → 创建长期凭证
     ├─ GitLab: Project Access Token (永不过期)
     └─ GitHub: Deploy Key (永不过期)
  → 存储到 K8s Secret
  → 简单、可靠、专业
```

## 实现细节

### 1. 数据库 Schema

**新表：`git_credentials`**

```typescript
{
  id: uuid,
  projectId: uuid,
  type: 'gitlab_project_token' | 'github_deploy_key',
  
  // GitLab
  gitlabTokenId: string,
  gitlabProjectId: string,
  
  // GitHub
  githubKeyId: string,
  githubRepoFullName: string,
  
  // 通用
  token: string, // 加密存储
  scopes: string[],
  expiresAt: timestamp | null, // null = 永不过期
  revokedAt: timestamp | null,
}
```

### 2. GitAuthService

**核心服务：`packages/services/business/src/gitops/git-auth/git-auth.service.ts`**

#### 主要方法

```typescript
// 设置项目认证（自动选择 GitLab 或 GitHub）
async setupProjectAuth(data: {
  projectId: string
  repositoryId: string
  provider: 'github' | 'gitlab'
  repositoryUrl: string
  repositoryFullName: string
  userId: string
}): Promise<{ success: boolean; credentialId: string }>

// GitLab: 创建 Project Access Token
private async setupGitLabAuth(
  projectId: string,
  gitlabProjectId: string,
  userToken: string
): Promise<GitCredential>

// GitHub: 创建 Deploy Key
private async setupGitHubAuth(
  projectId: string,
  repoFullName: string,
  userToken: string
): Promise<GitCredential>

// 撤销凭证
async revokeCredential(projectId: string): Promise<{ success: boolean }>
```

### 3. GitLab Project Access Token

**API 调用：**

```typescript
POST /api/v4/projects/{id}/access_tokens
{
  "name": "juanie-platform-{projectId}",
  "scopes": ["read_repository"],
  "access_level": 10, // Guest (只读)
  "expires_at": null  // 永不过期
}
```

**特点：**
- ✅ 永不过期（或设置长期）
- ✅ 独立于用户账户
- ✅ 最小权限（只读）
- ✅ 可以独立撤销
- ✅ GitLab 官方推荐

### 4. GitHub Deploy Key

**API 调用：**

```typescript
POST /repos/{owner}/{repo}/keys
{
  "title": "Juanie Platform - {projectId}",
  "key": "{ssh_public_key}",
  "read_only": true
}
```

**特点：**
- ✅ 永不过期
- ✅ SSH 密钥（更安全）
- ✅ 只读权限
- ✅ 可以独立撤销
- ✅ GitHub 官方推荐

### 5. 集成流程

**项目初始化流程：**

```
1. Worker 接收项目初始化任务
   ↓
2. 发布 GitOps 设置请求事件
   ├─ 包含 userId
   ├─ 包含 repositoryUrl
   ↓
3. GitOpsEventHandlerService 处理事件
   ├─ 检测 Git 提供商（GitHub/GitLab）
   ├─ 调用 GitAuthService.setupProjectAuth()
   │   ├─ 获取用户 OAuth token（只用一次）
   │   ├─ 创建 Project Access Token 或 Deploy Key
   │   ├─ 存储到数据库
   │   └─ 创建 K8s Secret
   ↓
4. 使用长期凭证创建 GitOps 资源
   ├─ GitRepository
   ├─ Kustomization
   ↓
5. Flux 使用 Secret 访问仓库 ✓
   └─ 永不过期，无需刷新！
```

## 代码变更

### 新增文件

1. **`packages/core/core/src/database/schemas/git-credentials.schema.ts`**
   - Git 凭证表定义

2. **`packages/services/business/src/gitops/git-auth/git-auth.service.ts`**
   - Git 认证服务

3. **`packages/services/business/src/gitops/git-auth/git-auth.module.ts`**
   - Git 认证模块

### 修改文件

1. **`packages/services/business/src/gitops/gitops-event-handler.service.ts`**
   - 使用 GitAuthService 替代 OAuthAccountsService
   - 创建长期凭证而不是刷新 token

2. **`packages/services/business/src/gitops/flux/flux.module.ts`**
   - 导入 GitAuthModule
   - 移除 ScheduleModule 和 GitSecretRefresherService

3. **`packages/services/business/src/index.ts`**
   - 导出 GitAuthService

### 删除文件（可选）

1. **`packages/services/business/src/gitops/git-secret-refresher.service.ts`**
   - 不再需要定时刷新

## 数据库迁移

### 创建 git_credentials 表

```sql
CREATE TABLE git_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL, -- 'gitlab_project_token', 'github_deploy_key'
  
  -- GitLab
  gitlab_token_id TEXT,
  gitlab_project_id TEXT,
  
  -- GitHub
  github_key_id TEXT,
  github_repo_full_name TEXT,
  
  -- 通用
  token TEXT NOT NULL, -- 加密存储
  scopes JSONB,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_git_credentials_project_id ON git_credentials(project_id);
CREATE INDEX idx_git_credentials_revoked ON git_credentials(revoked_at) WHERE revoked_at IS NULL;
```

### 迁移现有项目（可选）

```typescript
// 为现有项目创建长期凭证
async migrateExistingProjects() {
  const projects = await db.select().from(schema.projects)
  
  for (const project of projects) {
    const repository = await getRepository(project.id)
    if (!repository) continue
    
    const owner = await getProjectOwner(project.id)
    
    await gitAuthService.setupProjectAuth({
      projectId: project.id,
      repositoryId: repository.id,
      provider: repository.provider,
      repositoryUrl: repository.cloneUrl,
      repositoryFullName: repository.fullName,
      userId: owner.userId,
    })
  }
}
```

## 环境变量

```bash
# GitLab 配置
GITLAB_BASE_URL=https://gitlab.com
GITLAB_CLIENT_ID=xxx
GITLAB_CLIENT_SECRET=xxx

# GitHub 配置
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# K3s 配置
K3S_KUBECONFIG_PATH=~/.kube/config
```

## 安全考虑

### Token 存储

- ✅ 存储在数据库中（应该加密）
- ✅ 不暴露给前端
- ✅ 最小权限（只读）

### Token 撤销

```typescript
// 撤销项目的 Git 凭证
await gitAuthService.revokeCredential(projectId)

// 会执行：
// 1. 从 GitLab/GitHub 撤销 token/key
// 2. 删除 K8s Secret
// 3. 标记数据库记录为已撤销
```

### 审计日志

建议添加审计日志记录：
- 凭证创建
- 凭证使用
- 凭证撤销

## 测试

### 单元测试

```typescript
describe('GitAuthService', () => {
  it('should create GitLab Project Access Token', async () => {
    const result = await gitAuthService.setupProjectAuth({
      projectId: 'test-project',
      provider: 'gitlab',
      // ...
    })
    
    expect(result.success).toBe(true)
    expect(result.credentialId).toBeDefined()
  })
  
  it('should create GitHub Deploy Key', async () => {
    const result = await gitAuthService.setupProjectAuth({
      projectId: 'test-project',
      provider: 'github',
      // ...
    })
    
    expect(result.success).toBe(true)
  })
})
```

### 集成测试

```bash
# 1. 创建测试项目
curl -X POST /api/projects \
  -d '{"name": "test", "template": "nextjs-15-app"}'

# 2. 验证 Git 凭证已创建
SELECT * FROM git_credentials WHERE project_id = 'xxx';

# 3. 验证 K8s Secret 已创建
kubectl get secret xxx-git-auth -n project-xxx-development

# 4. 验证 Flux 可以访问仓库
kubectl get gitrepository -A
```

## 故障排查

### GitLab Token 创建失败

```bash
# 检查用户权限
# 用户必须是项目的 Maintainer 或 Owner

# 检查 GitLab API
curl -X POST https://gitlab.com/api/v4/projects/{id}/access_tokens \
  -H "PRIVATE-TOKEN: $USER_TOKEN" \
  -d "name=test&scopes[]=read_repository"
```

### GitHub Deploy Key 创建失败

```bash
# 检查用户权限
# 用户必须有仓库的 admin 权限

# 检查 GitHub API
curl -X POST https://api.github.com/repos/{owner}/{repo}/keys \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"title":"test","key":"ssh-ed25519 ...","read_only":true}'
```

### Flux 无法访问仓库

```bash
# 检查 Secret
kubectl get secret xxx-git-auth -n project-xxx-development -o yaml

# 检查 GitRepository 状态
kubectl describe gitrepository xxx-repo -n project-xxx-development

# 常见错误：
# - "authentication required" → Secret 不存在或无效
# - "repository not found" → URL 错误
```

## 最佳实践

1. **Token 加密**
   - 使用 AES-256 加密存储 token
   - 密钥存储在环境变量或密钥管理系统

2. **权限最小化**
   - GitLab: Guest level (10)
   - GitHub: read_only = true
   - 只授予 read_repository 权限

3. **定期审计**
   - 记录凭证创建和使用
   - 定期检查未使用的凭证
   - 自动撤销已删除项目的凭证

4. **错误处理**
   - 凭证创建失败不应阻塞项目创建
   - 提供清晰的错误信息
   - 支持手动重试

## 与业界对比

| 平台 | 方案 | 凭证类型 | 过期时间 |
|------|------|---------|---------|
| **Vercel** | GitHub App | Installation Token | 1小时（自动刷新） |
| **Netlify** | GitHub App | Installation Token | 1小时（自动刷新） |
| **GitLab CI** | Project Token | Access Token | 可配置/永不过期 |
| **Argo CD** | Deploy Key | SSH Key | 永不过期 |
| **我们** | Project Token / Deploy Key | Access Token / SSH | 永不过期 ✅ |

## 总结

✅ 使用业界标准方案
✅ 不需要定时刷新
✅ 简单、可靠、专业
✅ 支持 GitLab 和 GitHub
✅ 最小权限原则
✅ 可以独立撤销

这是正确的实现方式！
