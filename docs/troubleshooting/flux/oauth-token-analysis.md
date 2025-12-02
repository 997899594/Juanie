# OAuth Token 方案深度分析

## 自检清单

### ✅ 当前需求符合度

#### 1. 单用户场景 ✅
```
用户 A 创建项目 → 使用用户 A 的 OAuth token → Flux 访问用户 A 的仓库
```
**结论**：完美支持

#### 2. 多项目场景 ✅
```
用户 A 创建项目 1 → 使用 OAuth token 访问仓库 1
用户 A 创建项目 2 → 使用 OAuth token 访问仓库 2
```
**结论**：一个 token 可以访问多个仓库，完美支持

#### 3. 网络兼容性 ✅
```
当前问题：SSH (22) 端口被防火墙阻止
OAuth 方案：HTTPS (443) 端口，不受限制
```
**结论**：解决了当前的网络问题

---

### ⚠️ 潜在问题分析

#### 问题 1：多用户协作场景 ⚠️

**场景描述**：
```
用户 A 创建项目，使用用户 A 的 OAuth token
用户 B 加入项目（projectMembers）
用户 B 想要触发部署或查看 GitOps 状态
```

**问题**：
- Flux 使用的是用户 A 的 token
- 用户 B 没有自己的 token 在项目中
- 如果用户 A 离职或撤销 OAuth 连接，项目会中断

**影响程度**：🔴 高

**当前实现**：
```typescript
// project_members 表
{
  projectId: uuid,
  userId: uuid,
  role: 'owner' | 'maintainer' | 'developer' | 'viewer'
}

// 但 GitOps 只使用项目创建者的 token
```

#### 问题 2：Token 过期和撤销 ⚠️

**GitHub OAuth Token**：
- 永不过期（除非用户手动撤销）
- 用户撤销后，所有使用该 token 的项目都会失败

**GitLab OAuth Token**：
- 2 小时过期（已实现自动刷新 ✅）
- 但刷新后需要更新 K8s Secret（未实现 ❌）

**影响程度**：🟡 中

#### 问题 3：权限范围过大 ⚠️

**当前 OAuth 权限**：
```typescript
// GitHub
'repo'  // 访问用户的所有仓库（公开和私有）

// GitLab
'api'   // 完整 API 访问
```

**问题**：
- 用户可能不想授予平台访问所有仓库的权限
- 安全审计时可能被质疑

**影响程度**：🟡 中

#### 问题 4：组织/团队场景 🔴

**场景描述**：
```
组织 A 有多个成员
团队 1 负责项目 X
团队 2 负责项目 Y
```

**问题**：
- 如果使用个人 OAuth token，仓库必须在个人账户下
- 如果仓库在组织账户下，需要组织级别的认证
- GitHub Organizations 和 GitLab Groups 的权限模型不同

**影响程度**：🔴 高

---

### 🔮 未来需求预测

#### 需求 1：企业级多租户 🔴

**可能的场景**：
```
公司 A 使用平台
  ├─ 组织 1（前端团队）
  │   ├─ 项目 A（React 应用）
  │   └─ 项目 B（Vue 应用）
  └─ 组织 2（后端团队）
      ├─ 项目 C（Node.js API）
      └─ 项目 D（Python 服务）
```

**需求**：
- 每个组织有自己的 Git 账户
- 项目应该使用组织的凭证，而非个人凭证
- 成员离职不影响项目运行

**OAuth Token 方案的问题**：
- OAuth token 绑定到个人账户
- 无法实现组织级别的凭证管理

#### 需求 2：服务账户（Service Account）🔴

**最佳实践**：
```
生产环境应该使用服务账户，而非个人账户
- GitHub: GitHub App 或 Machine User
- GitLab: Project Access Token 或 Group Access Token
```

**OAuth Token 方案的问题**：
- OAuth 是用户级别的认证
- 无法创建独立的服务账户

#### 需求 3：细粒度权限控制 🟡

**可能的需求**：
```
项目 A：只读访问（只部署，不推送）
项目 B：读写访问（可以推送代码）
项目 C：限制到特定分支
```

**OAuth Token 方案的问题**：
- 一个 token 的权限是固定的
- 无法针对不同项目设置不同权限

#### 需求 4：审计和合规 🟡

**企业需求**：
```
- 谁在什么时候访问了哪个仓库？
- Token 的使用情况如何？
- 如何快速撤销某个项目的访问权限？
```

**OAuth Token 方案的问题**：
- Token 共享使用，难以追踪具体操作
- 撤销 token 会影响所有项目

---

## 方案对比

### 方案 A：纯 OAuth Token（当前提议）

**优势**：
- ✅ 实现简单
- ✅ 解决网络问题
- ✅ 用户体验好（无需额外配置）

**劣势**：
- ❌ 多用户协作问题
- ❌ 无法支持组织级别认证
- ❌ 权限范围过大
- ❌ 难以扩展到企业场景

**适用场景**：
- 个人开发者
- 小团队（< 5 人）
- 原型验证阶段

### 方案 B：混合方案（推荐）⭐

**架构**：
```typescript
interface ProjectGitAuth {
  projectId: string
  authType: 'oauth' | 'deploy_key' | 'project_token' | 'service_account'
  
  // OAuth 方式
  oauthAccountId?: string  // 关联到 oauthAccounts
  
  // Deploy Key 方式（GitHub）
  deployKeyId?: string
  privateKey?: string
  
  // Project Token 方式（GitLab）
  projectTokenId?: string
  token?: string
  
  // Service Account 方式（未来）
  serviceAccountId?: string
}
```

**实现策略**：
1. **默认使用 OAuth Token**（简单场景）
2. **可选升级到 Deploy Key/Project Token**（企业场景）
3. **未来支持 Service Account**（大型组织）

**优势**：
- ✅ 向后兼容
- ✅ 灵活扩展
- ✅ 满足不同场景需求
- ✅ 平滑迁移路径

### 方案 C：完全使用 Project-level Token

**架构**：
```
每个项目创建独立的凭证
- GitHub: Deploy Key（只读）或 Fine-grained PAT（读写）
- GitLab: Project Access Token
```

**优势**：
- ✅ 权限隔离
- ✅ 独立管理
- ✅ 符合企业最佳实践

**劣势**：
- ❌ 需要解决网络问题（SSH 端口）
- ❌ 配置复杂
- ❌ 用户体验较差

---

## 推荐方案：渐进式混合方案

### 阶段 1：MVP（当前）✅

**使用 OAuth Token**：
- 快速解决网络问题
- 简单易用
- 适合早期用户

**实现**：
```typescript
// 1. 简化 GitAuthService
async setupProjectAuth(projectId, userId) {
  const oauthAccount = await this.getOAuthAccount(userId)
  return { authType: 'oauth', oauthAccountId: oauthAccount.id }
}

// 2. 直接使用 OAuth token 创建 K8s Secret
await createSecret(namespace, secretName, {
  username: 'x-access-token',
  password: oauthAccount.accessToken
})
```

### 阶段 2：企业功能（3-6 个月后）

**添加 Project Token 支持**：
```typescript
// 用户可以选择认证方式
interface CreateProjectInput {
  authType: 'oauth' | 'project_token'
  
  // 如果选择 project_token
  tokenConfig?: {
    provider: 'github' | 'gitlab'
    token: string  // 用户提供的 Fine-grained PAT 或 Project Token
    scopes: string[]
  }
}
```

**优势**：
- 支持组织级别的仓库
- 更细粒度的权限控制
- 不依赖个人账户

### 阶段 3：企业级（6-12 个月后）

**添加 Service Account 支持**：
```typescript
// GitHub App 集成
interface GitHubAppAuth {
  appId: string
  installationId: string
  privateKey: string
}

// GitLab Group Token
interface GitLabGroupAuth {
  groupId: string
  accessToken: string
}
```

---

## 数据库 Schema 设计

### 新表：project_git_auth

```typescript
export const projectGitAuth = pgTable('project_git_auth', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  
  // 认证类型
  authType: text('auth_type').notNull(), // 'oauth' | 'deploy_key' | 'project_token' | 'service_account'
  
  // OAuth 方式（关联到 oauthAccounts）
  oauthAccountId: uuid('oauth_account_id').references(() => oauthAccounts.id),
  
  // Deploy Key 方式（GitHub SSH）
  deployKeyId: text('deploy_key_id'),
  privateKey: text('private_key'), // 加密存储
  
  // Project Token 方式
  projectToken: text('project_token'), // 加密存储
  tokenScopes: jsonb('token_scopes').$type<string[]>(),
  tokenExpiresAt: timestamp('token_expires_at'),
  
  // Service Account 方式（未来）
  serviceAccountId: uuid('service_account_id'),
  
  // 元数据
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

---

## 实施建议

### 立即执行（解决当前问题）✅

1. **使用 OAuth Token 方案**
   - 修改 `FluxResourcesService` 使用 HTTPS
   - 直接使用 `oauthAccounts` 表的 token
   - 添加 GitLab token 自动刷新到 K8s Secret

2. **添加文档和警告**
   - 说明当前方案的限制
   - 提示企业用户未来会有更好的方案

### 短期优化（1-2 个月）

1. **添加 Token 健康检查**
   ```typescript
   // 定期检查 token 是否有效
   async checkTokenHealth(projectId: string) {
     const auth = await this.getProjectAuth(projectId)
     const isValid = await this.validateToken(auth.token)
     if (!isValid) {
       // 通知用户重新授权
       await this.notifyTokenExpired(projectId)
     }
   }
   ```

2. **实现 Token 刷新机制**
   ```typescript
   // GitLab token 刷新后更新 K8s Secret
   async refreshProjectSecrets(projectId: string) {
     const oauthAccount = await this.getOAuthAccount(...)
     await this.updateK8sSecrets(projectId, oauthAccount.accessToken)
   }
   ```

### 中期扩展（3-6 个月）

1. **添加 Project Token 支持**
   - 用户可以选择使用 OAuth 或 Project Token
   - 支持 GitHub Fine-grained PAT
   - 支持 GitLab Project Access Token

2. **实现认证方式切换**
   ```typescript
   // 允许用户切换认证方式
   async switchAuthType(projectId: string, newAuthType: 'oauth' | 'project_token') {
     // 迁移逻辑
   }
   ```

---

## 结论

### 当前方案评估：⚠️ 有条件推荐

**推荐使用 OAuth Token 方案，但需要：**

1. ✅ **立即实施**：解决当前的网络问题
2. ⚠️ **明确限制**：在文档中说明适用场景
3. 📋 **规划升级**：为未来的企业功能预留扩展点

### 关键决策

**如果你的目标是**：
- 快速验证产品（MVP）→ ✅ 使用 OAuth Token
- 吸引个人开发者和小团队 → ✅ 使用 OAuth Token
- 进入企业市场 → ⚠️ 需要混合方案

**如果你的用户是**：
- 个人开发者 → ✅ OAuth Token 完美
- 小团队（< 10 人）→ ✅ OAuth Token 可用
- 中型团队（10-50 人）→ ⚠️ 需要 Project Token 选项
- 大型企业（> 50 人）→ ❌ 必须支持 Service Account

### 最终建议

**采用渐进式策略**：

1. **现在**：实施 OAuth Token 方案（解决燃眉之急）
2. **同时**：设计灵活的数据模型（支持未来扩展）
3. **未来**：根据用户反馈添加企业功能

这样既能快速解决当前问题，又不会在未来陷入技术债务。
