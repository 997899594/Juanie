# 正确的 Git 认证方案

## 问题分析

**错误做法：使用用户短期 OAuth Token**
- OAuth Token 是给用户交互用的（2小时过期）
- 需要定时刷新（很 low）
- 依赖用户账户状态

**正确做法：使用服务专用的长期凭证**
- Project Access Token（GitLab）
- Deploy Token（GitLab）
- GitHub App Installation Token（GitHub）
- Deploy Keys（SSH）

## 业界标准方案

### GitLab：Project Access Token

这是 GitLab 官方推荐的方式，用于 CI/CD 和自动化。

#### 特点
- ✅ 永不过期（或长期有效）
- ✅ 独立于用户账户
- ✅ 可以设置最小权限
- ✅ 可以独立撤销
- ✅ 不需要刷新逻辑

#### 实现

```typescript
@Injectable()
export class GitLabAuthService {
  /**
   * 创建 Project Access Token
   * 用户 OAuth token 只用一次，之后不再需要
   */
  async setupProjectAuth(
    userId: string,
    projectId: string,
    gitlabProjectId: string
  ) {
    // 1. 获取用户的 OAuth token（只用一次）
    const userAccount = await this.oauthAccounts.getAccountByProvider(
      userId,
      'gitlab'
    )
    
    if (!userAccount?.accessToken) {
      throw new Error('User not connected to GitLab')
    }
    
    // 2. 使用用户 token 创建 Project Access Token
    const projectToken = await this.createProjectAccessToken(
      userAccount.accessToken,
      gitlabProjectId,
      projectId
    )
    
    // 3. 存储 Project Access Token（长期有效）
    await this.storeProjectToken(projectId, projectToken)
    
    // 4. 创建 K8s Secret
    await this.createK8sSecret(projectId, projectToken.token)
    
    // 5. 用户的 OAuth token 可以过期了，不影响 GitOps
    return projectToken
  }
  
  private async createProjectAccessToken(
    userToken: string,
    gitlabProjectId: string,
    platformProjectId: string
  ) {
    const gitlabUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com'
    
    const response = await fetch(
      `${gitlabUrl}/api/v4/projects/${gitlabProjectId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': userToken,
        },
        body: JSON.stringify({
          name: `juanie-platform-${platformProjectId}`,
          scopes: ['read_repository'], // 只读权限
          access_level: 10, // Guest level
          expires_at: null, // 永不过期
        }),
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create project access token: ${error.message}`)
    }
    
    return await response.json()
  }
  
  private async storeProjectToken(projectId: string, token: any) {
    await this.db.insert(schema.gitCredentials).values({
      projectId,
      type: 'project_access_token',
      tokenId: token.id,
      token: await this.encrypt(token.token),
      scopes: token.scopes,
      expiresAt: token.expires_at ? new Date(token.expires_at) : null,
      createdAt: new Date(),
    })
  }
  
  private async createK8sSecret(projectId: string, token: string) {
    const environments = await this.getProjectEnvironments(projectId)
    
    for (const env of environments) {
      const namespace = `project-${projectId}-${env.type}`
      const secretName = `${projectId}-git-auth`
      
      await this.k3s.createSecret(
        namespace,
        secretName,
        {
          username: 'project-token',
          password: token,
        },
        'Opaque'
      )
    }
  }
  
  /**
   * 撤销 Project Access Token
   */
  async revokeProjectAuth(projectId: string) {
    const credential = await this.db
      .select()
      .from(schema.gitCredentials)
      .where(eq(schema.gitCredentials.projectId, projectId))
      .limit(1)
    
    if (!credential) return
    
    // 1. 从 GitLab 撤销
    await fetch(
      `${gitlabUrl}/api/v4/projects/${gitlabProjectId}/access_tokens/${credential.tokenId}`,
      {
        method: 'DELETE',
        headers: { 'PRIVATE-TOKEN': adminToken },
      }
    )
    
    // 2. 删除 K8s Secret
    await this.deleteK8sSecrets(projectId)
    
    // 3. 更新数据库
    await this.db
      .update(schema.gitCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(schema.gitCredentials.projectId, projectId))
  }
}
```

### GitHub：GitHub App

GitHub 推荐使用 GitHub App 而不是 Personal Access Token。

#### 特点
- ✅ Installation Token 由 GitHub 管理
- ✅ 自动刷新（GitHub 处理）
- ✅ 细粒度权限
- ✅ 审计日志

#### 实现

```typescript
@Injectable()
export class GitHubAppService {
  /**
   * 使用 GitHub App 获取 Installation Token
   * Token 1小时有效，但由 GitHub 管理刷新
   */
  async getInstallationToken(installationId: string) {
    // 1. 生成 GitHub App JWT
    const jwt = this.generateAppJWT()
    
    // 2. 获取 Installation Token
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )
    
    const { token, expires_at } = await response.json()
    
    // 3. 缓存 token（1小时有效）
    await this.cacheToken(installationId, token, expires_at)
    
    return token
  }
  
  /**
   * 获取 token（自动处理过期）
   */
  async getToken(installationId: string) {
    // 检查缓存
    const cached = await this.getCachedToken(installationId)
    
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached.token
    }
    
    // 过期了，重新获取（不是定时刷新，而是按需获取）
    return await this.getInstallationToken(installationId)
  }
  
  private generateAppJWT() {
    const jwt = require('jsonwebtoken')
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
    
    return jwt.sign(
      {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600, // 10分钟
        iss: process.env.GITHUB_APP_ID,
      },
      privateKey,
      { algorithm: 'RS256' }
    )
  }
}
```

## 数据库 Schema

```typescript
// 新的 git_credentials 表
export const gitCredentials = pgTable('git_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  
  // 凭证类型
  type: text('type').notNull(), // 'project_access_token', 'deploy_token', 'github_app'
  
  // GitLab Project Access Token
  tokenId: text('token_id'), // GitLab token ID（用于撤销）
  token: text('token').notNull(), // 加密存储
  scopes: jsonb('scopes').$type<string[]>(),
  
  // GitHub App
  installationId: text('installation_id'),
  
  // 通用
  expiresAt: timestamp('expires_at'), // null = 永不过期
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

## 迁移方案

### 从 OAuth Token 迁移到 Project Access Token

```typescript
@Injectable()
export class GitAuthMigrationService {
  /**
   * 迁移现有项目到 Project Access Token
   */
  async migrateProject(projectId: string) {
    // 1. 获取项目信息
    const project = await this.getProject(projectId)
    const repository = await this.getRepository(projectId)
    
    // 2. 获取 organization owner 的 OAuth token
    const owner = await this.getProjectOwner(projectId)
    const oauthAccount = await this.oauthAccounts.getAccountByProvider(
      owner.userId,
      repository.provider
    )
    
    if (!oauthAccount?.accessToken) {
      throw new Error('Owner not connected to Git provider')
    }
    
    // 3. 创建 Project Access Token
    const projectToken = await this.gitlabAuth.createProjectAccessToken(
      oauthAccount.accessToken,
      repository.externalId,
      projectId
    )
    
    // 4. 更新 K8s Secret
    await this.updateK8sSecrets(projectId, projectToken.token)
    
    // 5. 标记迁移完成
    await this.db
      .update(schema.projects)
      .set({ 
        gitAuthMigrated: true,
        updatedAt: new Date()
      })
      .where(eq(schema.projects.id, projectId))
    
    return { success: true }
  }
}
```

## 总结

### 错误方案（你当前的）
```
用户 OAuth Token (2小时) 
  → 定时刷新 (每小时)
  → 更新 K8s Secret
  → 很 low
```

### 正确方案
```
用户 OAuth Token (只用一次)
  → 创建 Project Access Token (永不过期)
  → 存储到 K8s Secret
  → 不需要刷新！
```

### 关键区别

| 方案 | Token 类型 | 有效期 | 需要刷新 | 业界使用 |
|------|-----------|--------|---------|---------|
| 错误 | 用户 OAuth | 2小时 | ✅ 需要 | ❌ 没人这么做 |
| 正确 | Project Access | 永久 | ❌ 不需要 | ✅ GitLab 官方推荐 |
| 正确 | Deploy Token | 永久 | ❌ 不需要 | ✅ 常用 |
| 正确 | GitHub App | 1小时 | ✅ 按需 | ✅ GitHub 推荐 |

## 下一步

1. 实现 Project Access Token 创建
2. 迁移现有项目
3. 删除定时刷新逻辑
4. 更新文档
