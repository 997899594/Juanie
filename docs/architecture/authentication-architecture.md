# 认证架构全景图

## 概述

本文档全面梳理项目中所有认证相关的逻辑，包括用户认证、Git OAuth 连接、API 认证、K8s 认证等。

## 认证架构图

```mermaid
graph TB
    subgraph "前端 (Vue 3)"
        A[用户] --> B[Router Guard]
        B --> C[Auth Store]
        C --> D[tRPC Client]
    end
    
    subgraph "后端 (NestJS + tRPC)"
        D --> E[tRPC Adapter]
        E --> F[Context Creation]
        F --> G{认证类型}
        
        G -->|公开 API| H[procedure]
        G -->|受保护 API| I[protectedProcedure]
        
        I --> J[Auth Middleware]
        J --> K[AuthService.validateSession]
        K --> L[Redis Session Store]
    end
    
    subgraph "OAuth 认证流程"
        M[OAuth Login] --> N[GitHub/GitLab OAuth]
        N --> O[AuthService.handleOAuthCallback]
        O --> P[创建/更新用户]
        P --> Q[保存 Git Connection]
        Q --> R[创建 Session]
        R --> S[设置 Cookie]
    end
    
    subgraph "Git 集成认证"
        T[Git 操作] --> U[GitConnectionsService]
        U --> V[获取 Access Token]
        V --> W[调用 Git API]
    end
    
    subgraph "K8s 认证"
        X[K8s 操作] --> Y[K3sService]
        Y --> Z[K3S_TOKEN]
        Z --> AA[K8s API]
    end
```

---

## 1. 用户认证 (Session-Based)

### 1.1 认证流程

**登录流程**:
1. 用户点击 "使用 GitHub/GitLab 登录"
2. 前端调用 `trpc.auth.getGitHubAuthUrl` 或 `trpc.auth.getGitLabAuthUrl`
3. 后端生成 OAuth URL 和 state，存储到 Redis（10 分钟过期）
4. 用户跳转到 GitHub/GitLab 授权页面
5. 用户授权后，Git 平台回调到 `/auth/{provider}/callback?code=xxx&state=xxx`
6. 后端验证 state，交换 access token
7. 后端获取用户信息，创建或更新用户
8. 后端创建 session，存储到 Redis（7 天过期）
9. 后端设置 `sessionId` Cookie（HttpOnly, Secure）
10. 前端跳转到首页

**会话验证流程**:
1. 前端每次请求自动携带 `sessionId` Cookie
2. tRPC Adapter 从 Cookie 中提取 `sessionId`
3. tRPC Middleware 调用 `AuthService.validateSession(sessionId)`
4. AuthService 从 Redis 查询 session，获取 userId
5. AuthService 从数据库查询用户信息
6. 返回用户信息到 Context

**登出流程**:
1. 前端调用 `trpc.auth.logout`
2. 后端从 Redis 删除 session
3. 后端清除 `sessionId` Cookie
4. 前端清除本地状态

### 1.2 核心组件

#### 后端

**AuthService** (`packages/services/foundation/src/auth/auth.service.ts`)
- `getGitHubAuthUrl()`: 生成 GitHub OAuth URL
- `getGitLabAuthUrl()`: 生成 GitLab OAuth URL
- `handleOAuthCallback()`: 统一处理 OAuth 回调
- `handleGitHubCallback()`: 处理 GitHub 回调
- `handleGitLabCallback()`: 处理 GitLab 回调
- `createSession()`: 创建会话（存储到 Redis）
- `validateSession()`: 验证会话（从 Redis 查询）
- `deleteSession()`: 删除会话（从 Redis 删除）

**TrpcService** (`apps/api-gateway/src/trpc/trpc.service.ts`)
- `procedure`: 公开的 procedure（无需认证）
- `protectedProcedure`: 受保护的 procedure（需要认证）
  - 中间件：验证 sessionId，调用 `AuthService.validateSession()`
  - 将用户信息注入到 Context

**TrpcAdapter** (`apps/api-gateway/src/trpc/trpc.adapter.ts`)
- `createContext()`: 从 Cookie 中提取 `sessionId`
- 将 `sessionId` 注入到 tRPC Context

#### 前端

**Auth Store** (`apps/web/src/stores/auth.ts`)
- `user`: 当前用户信息
- `isAuthenticated`: 是否已认证（computed）
- `initialize()`: 初始化认证状态（调用 `trpc.auth.validateSession`）
- `setUser()`: 设置用户信息
- `logout()`: 登出（调用 `trpc.auth.logout`）
- `clearAuth()`: 清除本地状态

**Router Guard** (`apps/web/src/router/index.ts`)
- `beforeEach()`: 路由守卫
  - 检查路由是否需要认证（`meta.requiresAuth`）
  - 如果未认证，跳转到登录页
  - 如果已认证且访问登录页，跳转到首页

### 1.3 数据模型

**users 表** (`packages/core/src/database/schemas/users.schema.ts`)
```typescript
{
  id: uuid (PK)
  email: text (unique, not null)
  username: text (unique)
  displayName: text
  avatarUrl: text
  preferences: jsonb (语言、主题、通知等)
  lastLoginAt: timestamp
  deletedAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Session 存储** (Redis)
```typescript
Key: `session:{sessionId}`
Value: JSON.stringify({ userId, createdAt })
TTL: 7 天
```

**OAuth State 存储** (Redis)
```typescript
Key: `oauth:{provider}:{state}`
Value: 'github' | 'gitlab' | 'pending'
TTL: 10 分钟
```

---

## 2. Git OAuth 连接

### 2.1 用途

Git OAuth 连接有两个用途：
1. **用户登录认证**：用户通过 GitHub/GitLab 登录平台
2. **Git 集成**：平台代表用户操作 Git 仓库（创建、推送、删除等）

### 2.2 连接流程

**初次登录**:
- 用户通过 OAuth 登录时，自动创建 Git Connection
- `purpose` 设置为 `'both'`（同时用于认证和集成）

**连接额外账户**:
1. 用户在设置页面点击 "连接 GitHub/GitLab 账户"
2. 前端调用 `trpc.auth.getConnectAuthUrl`
3. 后端生成 OAuth URL，存储 state 和 userId 到 Redis
4. 用户授权后回调
5. 后端验证 state 和 userId，保存 Git Connection

### 2.3 核心组件

**GitConnectionsService** (`packages/services/foundation/src/git-connections/git-connections.service.ts`)
- `listUserConnections()`: 获取用户的所有 Git 连接
- `getConnectionByProvider()`: 根据 provider 获取连接
- `hasProvider()`: 检查用户是否已连接指定平台
- `upsertConnection()`: 创建或更新连接
- `deleteConnection()`: 删除连接
- `updateConnectionStatus()`: 更新连接状态
- `refreshAccessToken()`: 刷新访问令牌

### 2.4 数据模型

**git_connections 表** (`packages/core/src/database/schemas/git-connections.schema.ts`)
```typescript
{
  id: uuid (PK)
  userId: uuid (FK -> users.id)
  
  // Git 平台信息
  provider: text ('github' | 'gitlab')
  providerAccountId: text (Git 平台的用户 ID)
  
  // Git 用户信息
  username: text
  email: text
  avatarUrl: text
  
  // OAuth 凭证
  accessToken: text (加密存储)
  refreshToken: text
  expiresAt: timestamp
  
  // 状态管理
  status: text ('active' | 'expired' | 'revoked')
  purpose: text ('auth' | 'integration' | 'both')
  
  // Git 服务器配置（支持 GitLab 私有部署）
  serverUrl: text (例如: https://github.com, https://gitlab.company.com)
  serverType: text ('cloud' | 'self-hosted')
  
  // 元数据
  metadata: jsonb (serverVersion, serverName, scopes 等)
  
  // 同步状态
  connectedAt: timestamp
  lastSyncAt: timestamp
  
  createdAt: timestamp
  updatedAt: timestamp
}

// 唯一约束：(userId, provider, serverUrl)
// 用户可以连接多个 GitLab 服务器，但每个服务器只能连接一次
```

### 2.5 OAuth 权限范围

**GitHub**:
```typescript
[
  'user:email',        // 获取用户邮箱
  'repo',              // 完整的仓库访问权限（读写公开和私有仓库）
  'workflow',          // 管理 GitHub Actions workflows
  'admin:repo_hook',   // 管理仓库 webhooks
  'delete_repo',       // 删除仓库
]
```

**GitLab**:
```typescript
[
  'api',               // 完整 API 访问（包含所有操作）
  'read_user',         // 读取用户信息
  'read_repository',   // 读取仓库
  'write_repository',  // 写入仓库（创建、推送等）
]
```

---

## 3. API 认证 (tRPC)

### 3.1 认证类型

**公开 API** (`procedure`):
- 无需认证
- 任何人都可以访问
- 例如：`auth.getGitHubAuthUrl`, `auth.getGitLabAuthUrl`

**受保护 API** (`protectedProcedure`):
- 需要认证
- 必须提供有效的 `sessionId` Cookie
- 例如：`projects.list`, `deployments.list`, `users.me`

### 3.2 认证流程

1. 前端发起 tRPC 请求，自动携带 `sessionId` Cookie
2. tRPC Adapter 从 Cookie 中提取 `sessionId`，注入到 Context
3. `protectedProcedure` 中间件检查 Context 中是否有 `sessionId`
4. 调用 `AuthService.validateSession(sessionId)` 验证会话
5. 如果会话有效，将用户信息注入到 Context
6. 如果会话无效，抛出 `UNAUTHORIZED` 错误

### 3.3 Context 类型

```typescript
interface Context {
  sessionId?: string
  user?: {
    id: string
    email: string
  }
  reply?: FastifyReply
}
```

### 3.4 使用示例

```typescript
// 公开 API
export const authRouter = t.router({
  getGitHubAuthUrl: t.procedure
    .output(z.object({ url: z.string(), state: z.string() }))
    .query(async () => {
      return await authService.getGitHubAuthUrl()
    }),
})

// 受保护 API
export const projectsRouter = t.router({
  list: t.protectedProcedure
    .query(async ({ ctx }) => {
      // ctx.user 已经通过中间件验证和注入
      return await projectsService.listProjects(ctx.user.id)
    }),
})
```

---

## 4. Git Provider API 认证

### 4.1 用途

平台需要代表用户调用 Git Provider API（GitHub/GitLab）来执行以下操作：
- 创建仓库
- 推送代码
- 配置 Webhook
- 配置 Secrets
- 删除仓库

### 4.2 认证流程

1. 从数据库获取用户的 Git Connection
2. 提取 `accessToken`
3. 使用 `accessToken` 调用 Git Provider API

### 4.3 核心组件

**GitProviderService** (`packages/services/business/src/gitops/git-providers/git-provider.service.ts`)
- `createRepository()`: 创建仓库
- `deleteRepository()`: 删除仓库
- `configureWebhook()`: 配置 Webhook
- `configureSecrets()`: 配置 Secrets
- 内部使用 `GitConnectionsService` 获取 access token

### 4.4 Token 刷新

**GitLab Token 刷新**:
- GitLab access token 有过期时间（通常 2 小时）
- 需要使用 refresh token 刷新
- 刷新逻辑在 `GitProviderService` 中实现

**GitHub Token**:
- GitHub access token 不会过期（除非用户主动撤销）
- 无需刷新

---

## 5. K8s 认证

### 5.1 认证方式

使用 **Bearer Token** 认证：
- Token 存储在环境变量 `K3S_TOKEN` 中
- 每次调用 K8s API 时，在 HTTP Header 中携带 `Authorization: Bearer {K3S_TOKEN}`

### 5.2 核心组件

**K3sService** (`packages/services/business/src/gitops/k3s/k3s.service.ts`)
- 使用 `BunK8sClient` 调用 K8s API
- 自动注入 `K3S_TOKEN`

**BunK8sClient** (`packages/services/business/src/gitops/k3s/bun-k8s-client.ts`)
- 轻量级 K8s 客户端
- 使用 Bun 的 `fetch` API
- 自动处理认证 Header

### 5.3 配置

```bash
# .env
K3S_HOST=https://your-k3s-server:6443
K3S_TOKEN=your-k3s-token
```

---

## 6. 部署触发认证

### 6.1 背景

GitHub Actions 构建完成后，需要通知平台触发 Flux reconcile。

### 6.2 认证方案

**最终方案：无认证公开 API**

**原因**:
1. **信任 GitHub Actions**：只有有权限的人才能触发 workflow
2. **简化认证逻辑**：无需创建和管理 token
3. **业界实践**：Vercel、Netlify 等平台都采用类似方案

**API 设计**:
```typescript
POST /trpc/deployments.trigger
Body: { projectId: string }

// 只验证项目是否存在，不验证用户身份
```

**安全性**:
- 只能触发 Flux reconcile，不能修改任何数据
- 项目 ID 是公开的（在 Git 仓库中）
- 即使被滥用，也只是多触发几次 reconcile（无害）

### 6.3 Workflow 配置

```yaml
# .github/workflows/build-project-image.yml
- name: Trigger Deployment
  run: |
    curl -X POST "${{ secrets.PLATFORM_API_URL }}/trpc/deployments.trigger" \
      -H "Content-Type: application/json" \
      -d '{"projectId": "${{ secrets.PROJECT_ID }}"}'
```

---

## 7. 认证相关的环境变量

### 7.1 必需环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/juanie

# Redis
REDIS_URL=redis://localhost:6379

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

# GitLab OAuth
GITLAB_CLIENT_ID=your-gitlab-client-id
GITLAB_CLIENT_SECRET=your-gitlab-client-secret
GITLAB_REDIRECT_URI=http://localhost:3000/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com  # 或私有 GitLab 服务器

# K8s
K3S_HOST=https://your-k3s-server:6443
K3S_TOKEN=your-k3s-token

# 应用
APP_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173
```

---

## 8. 认证流程总结

### 8.1 用户登录流程

```
用户 -> 点击登录
  -> 前端: trpc.auth.getGitHubAuthUrl()
  -> 后端: 生成 OAuth URL + state
  -> 后端: 存储 state 到 Redis (10 分钟)
  -> 用户: 跳转到 GitHub 授权页面
  -> 用户: 授权
  -> GitHub: 回调到 /auth/github/callback?code=xxx&state=xxx
  -> 后端: 验证 state
  -> 后端: 交换 access token
  -> 后端: 获取用户信息
  -> 后端: 创建/更新用户
  -> 后端: 保存 Git Connection
  -> 后端: 创建 session (Redis, 7 天)
  -> 后端: 设置 sessionId Cookie (HttpOnly, Secure)
  -> 前端: 跳转到首页
```

### 8.2 API 请求流程

```
前端 -> tRPC 请求 (自动携带 sessionId Cookie)
  -> tRPC Adapter: 提取 sessionId
  -> tRPC Context: { sessionId }
  -> protectedProcedure Middleware: 验证 sessionId
  -> AuthService.validateSession(sessionId)
  -> Redis: 查询 session
  -> Database: 查询用户信息
  -> Context: { user: { id, email } }
  -> Router Handler: 执行业务逻辑
  -> 返回结果
```

### 8.3 Git 操作流程

```
业务逻辑 -> GitProviderService.createRepository()
  -> GitConnectionsService.getConnectionByProvider()
  -> Database: 查询 git_connections
  -> 提取 accessToken
  -> 调用 GitHub/GitLab API (Authorization: Bearer {accessToken})
  -> 返回结果
```

### 8.4 K8s 操作流程

```
业务逻辑 -> K3sService.createNamespace()
  -> BunK8sClient.request()
  -> 注入 Authorization: Bearer {K3S_TOKEN}
  -> 调用 K8s API
  -> 返回结果
```

---

## 9. 安全最佳实践

### 9.1 Session 安全

- ✅ Session 存储在 Redis（服务端）
- ✅ Session ID 通过 HttpOnly Cookie 传输（防止 XSS）
- ✅ Cookie 设置 Secure 标志（仅 HTTPS）
- ✅ Session 有过期时间（7 天）
- ✅ 登出时删除 Session

### 9.2 OAuth Token 安全

- ✅ Access Token 加密存储在数据库
- ✅ Refresh Token 加密存储在数据库
- ✅ Token 不暴露给前端
- ✅ Token 有过期时间（GitLab）
- ✅ 支持 Token 刷新（GitLab）

### 9.3 API 安全

- ✅ 受保护的 API 需要认证
- ✅ 公开的 API 最小化
- ✅ 使用 tRPC 类型安全
- ✅ 使用 Zod 验证输入

### 9.4 K8s 安全

- ✅ Token 存储在环境变量
- ✅ Token 不提交到 Git
- ✅ 使用 RBAC 限制权限

---

## 10. 常见问题

### 10.1 为什么不使用 JWT？

**原因**:
1. **Session-based 更简单**：无需处理 JWT 签名、验证、刷新等复杂逻辑
2. **更安全**：Session 存储在服务端，可以随时撤销
3. **更灵活**：可以存储更多信息（不受 JWT payload 大小限制）
4. **更适合 Web 应用**：Cookie-based 认证是 Web 应用的标准做法

### 10.2 为什么不使用 Passport.js？

**原因**:
1. **Arctic 更现代**：专为现代 TypeScript 应用设计
2. **更轻量**：只关注 OAuth，不包含其他认证策略
3. **更简单**：API 更简洁，易于理解和维护
4. **类型安全**：完整的 TypeScript 支持

### 10.3 为什么 Git Connection 和 Session 分开存储？

**原因**:
1. **职责分离**：Session 用于认证，Git Connection 用于集成
2. **生命周期不同**：Session 7 天过期，Git Connection 长期有效
3. **数据持久化**：Git Connection 需要持久化到数据库，Session 可以存储在 Redis
4. **支持多账户**：用户可以连接多个 Git 账户（例如多个 GitLab 服务器）

### 10.4 为什么部署触发 API 不需要认证？

**原因**:
1. **信任 GitHub Actions**：只有有权限的人才能触发 workflow
2. **简化认证逻辑**：无需创建和管理 token
3. **业界实践**：Vercel、Netlify 等平台都采用类似方案
4. **安全性足够**：只能触发 reconcile，不能修改数据

### 10.5 如何支持多个 GitLab 服务器？

**方案**:
- `git_connections` 表使用 `(userId, provider, serverUrl)` 作为唯一约束
- 用户可以连接多个 GitLab 服务器（例如公司内部 GitLab + GitLab.com）
- 每个服务器有独立的 OAuth 配置和 access token

---

## 11. 改进建议

### 11.1 短期改进

1. **添加 Token 加密**
   - 当前 access token 明文存储在数据库
   - 建议使用 AES-256 加密存储
   - 使用环境变量 `ENCRYPTION_KEY` 作为密钥

2. **添加 Rate Limiting**
   - 防止暴力破解和 DDoS 攻击
   - 使用 Redis 实现 Rate Limiting
   - 限制每个 IP 的请求频率

3. **添加审计日志**
   - 记录所有认证相关的操作（登录、登出、Token 刷新等）
   - 存储到数据库或日志系统
   - 用于安全审计和问题排查

### 11.2 长期改进

1. **支持多因素认证 (MFA)**
   - 支持 TOTP（Time-based One-Time Password）
   - 支持 SMS 验证码
   - 支持硬件密钥（WebAuthn）

2. **支持 SSO (Single Sign-On)**
   - 支持 SAML 2.0
   - 支持 OpenID Connect
   - 支持企业 IdP（Okta、Auth0 等）

3. **支持 API Key 认证**
   - 用于 CI/CD 集成
   - 用于第三方应用集成
   - 支持 API Key 的创建、撤销、过期管理

---

## 12. 总结

### 12.1 认证架构特点

- ✅ **简单清晰**：Session-based 认证，易于理解和维护
- ✅ **安全可靠**：HttpOnly Cookie + Redis Session + Token 加密
- ✅ **职责分离**：用户认证、Git 集成、K8s 认证各司其职
- ✅ **支持多平台**：GitHub、GitLab（包括私有部署）
- ✅ **类型安全**：tRPC + TypeScript 全栈类型安全

### 12.2 认证流程总结

| 认证类型 | 认证方式 | 存储位置 | 过期时间 | 用途 |
|---------|---------|---------|---------|------|
| 用户认证 | Session-based | Redis | 7 天 | 用户登录、API 访问 |
| Git OAuth | Access Token | Database | 永久（GitHub）/ 2 小时（GitLab） | Git 操作 |
| K8s 认证 | Bearer Token | 环境变量 | 永久 | K8s 操作 |
| 部署触发 | 无认证 | - | - | Flux reconcile |

### 12.3 关键文件清单

**后端**:
- `packages/services/foundation/src/auth/auth.service.ts` - 用户认证服务
- `packages/services/foundation/src/git-connections/git-connections.service.ts` - Git 连接服务
- `apps/api-gateway/src/trpc/trpc.service.ts` - tRPC 认证中间件
- `apps/api-gateway/src/trpc/trpc.adapter.ts` - tRPC Context 创建
- `packages/services/business/src/gitops/git-providers/git-provider.service.ts` - Git Provider API 调用
- `packages/services/business/src/gitops/k3s/k3s.service.ts` - K8s API 调用

**前端**:
- `apps/web/src/stores/auth.ts` - 认证状态管理
- `apps/web/src/router/index.ts` - 路由守卫

**数据库**:
- `packages/core/src/database/schemas/users.schema.ts` - 用户表
- `packages/core/src/database/schemas/git-connections.schema.ts` - Git 连接表

---

## 附录：认证相关的 API 清单

### Auth Router

```typescript
// 公开 API
auth.getGitHubAuthUrl()        // 获取 GitHub OAuth URL
auth.getGitLabAuthUrl()        // 获取 GitLab OAuth URL
auth.getConnectAuthUrl()       // 获取连接账户的 OAuth URL

// 受保护 API
auth.validateSession()         // 验证会话
auth.logout()                  // 登出
auth.connectGitHubAccount()    // 连接 GitHub 账户
auth.connectGitLabAccount()    // 连接 GitLab 账户
```

### Git Connections Router

```typescript
// 受保护 API
gitConnections.list()          // 获取用户的所有 Git 连接
gitConnections.delete()        // 删除 Git 连接
```

### Projects Router

```typescript
// 受保护 API
projects.list()                // 获取项目列表
projects.create()              // 创建项目
projects.delete()              // 删除项目
// ... 其他项目相关 API
```

### Deployments Router

```typescript
// 公开 API
deployments.trigger()          // 触发部署（无需认证）

// 受保护 API
deployments.list()             // 获取部署列表
deployments.getById()          // 获取部署详情
// ... 其他部署相关 API
```


---

## 13. 严重问题：代码冗余和混乱

### 13.1 重复的 OAuth 服务

**问题**: 项目中存在**两套完全重复的 OAuth 实现**

#### 第一套：AuthService (正在使用)
- 位置: `packages/services/foundation/src/auth/auth.service.ts`
- 使用 **Arctic** 库（现代、类型安全）
- 功能完整：登录、回调、Token 管理
- ✅ **正在被使用**

#### 第二套：GitHubOAuthService + GitLabOAuthService (未使用)
- 位置: 
  - `packages/services/foundation/src/git-accounts/github-oauth.service.ts`
  - `packages/services/foundation/src/git-accounts/gitlab-oauth.service.ts`
- 使用 **axios** 手动实现 OAuth 流程
- 功能重复：授权 URL、Token 交换、用户信息获取、Token 刷新
- ❌ **完全未被使用**（只在 git-sync router 中被注入，但实际未调用）

**代码对比**:

```typescript
// AuthService (正在使用)
async getGitHubAuthUrl(): Promise<OAuthUrlResponse> {
  const state = generateId()
  const url = this.github.createAuthorizationURL(state, [...])
  await this.redis.setex(`oauth:github:${state}`, 600, 'github')
  return { url: url.toString(), state }
}

// GitHubOAuthService (未使用)
getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: this.clientId,
    redirect_uri: this.redirectUri,
    scope: 'read:user user:email repo admin:org',
    state,
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}
```

**影响**:
- 代码冗余：~400 行重复代码
- 维护成本：需要同时维护两套实现
- 混淆：新开发者不知道该用哪个
- 潜在 Bug：两套实现可能不一致

### 13.2 重复的 Git Connection 服务

**问题**: 项目中存在**两个功能重叠的 Git Connection 服务**

#### GitConnectionsService (新，推荐)
- 位置: `packages/services/foundation/src/git-connections/git-connections.service.ts`
- 功能: 管理 Git 连接（CRUD）
- 特点: 
  - 简洁清晰
  - 不处理 Token 加密（明文存储）
  - 支持多服务器（serverUrl）
- ✅ **被 AuthService 使用**

#### GitAccountLinkingService (旧，冗余)
- 位置: `packages/services/foundation/src/git-accounts/git-account-linking.service.ts`
- 功能: 管理 Git 账号关联（CRUD）
- 特点:
  - 使用 EncryptionService 加密 Token
  - 功能与 GitConnectionsService 90% 重复
  - 只支持单服务器（不支持多 GitLab 服务器）
- ⚠️ **只被 git-sync router 使用**

**代码对比**:

```typescript
// GitConnectionsService (新)
async upsertConnection(input: {...}): Promise<GitConnection> {
  const existing = await this.getConnectionByProvider(...)
  if (existing) {
    return await this.db.update(...)
  }
  return await this.db.insert(...)
}

// GitAccountLinkingService (旧)
async linkGitAccount(input: {...}): Promise<GitConnection> {
  const encryptedAccessToken = await this.encryptionService.encrypt(...)
  const existing = await this.db.query.gitConnections.findFirst(...)
  if (existing) {
    return await this.db.update(...)
  }
  return await this.db.insert(...)
}
```

**关键差异**:
1. **Token 加密**: GitAccountLinkingService 加密，GitConnectionsService 不加密
2. **多服务器支持**: GitConnectionsService 支持，GitAccountLinkingService 不支持
3. **查询方式**: GitConnectionsService 使用 Drizzle ORM，GitAccountLinkingService 使用 query API

### 13.3 Token 加密的混乱状态

**问题**: Token 加密状态不一致

#### AuthService 路径（用户登录）
- OAuth 回调 → AuthService.findOrCreateUser()
- 直接存储**明文** access token 到数据库
- ❌ **不安全**

#### GitAccountLinkingService 路径（手动关联）
- git-sync router → GitAccountLinkingService.linkGitAccount()
- 使用 EncryptionService **加密** access token
- ✅ **安全**

**结果**: 同一个 `git_connections` 表中，有些记录是明文，有些是密文！

```typescript
// 用户通过 OAuth 登录（明文）
await tx.insert(schema.gitConnections).values({
  accessToken: tokens.accessToken(), // 明文！
  ...
})

// 用户手动关联账户（密文）
await this.db.insert(schema.gitConnections).values({
  accessToken: encryptedAccessToken, // 密文！
  ...
})
```

### 13.4 未使用的模块和导出

**GitOAuthModule** (`packages/services/foundation/src/git-accounts/git-accounts.module.ts`)
- 导出: GitAccountLinkingService, GitHubOAuthService, GitLabOAuthService
- 实际使用: 只有 GitAccountLinkingService 被使用
- GitHubOAuthService 和 GitLabOAuthService **完全未被使用**

**EncryptionService** (`packages/services/foundation/src/encryption/encryption.service.ts`)
- 只被 GitAccountLinkingService 使用
- 如果删除 GitAccountLinkingService，这个服务也可以删除（或者用于其他用途）

---

## 14. 完整的问题清单

### 14.1 安全问题

1. ❌ **Token 明文存储**
   - AuthService 存储明文 access token
   - 严重安全隐患

2. ❌ **Token 加密不一致**
   - 同一表中混合明文和密文
   - 解密时会出错

3. ❌ **缺少 Rate Limiting**
   - 容易被暴力破解
   - 容易被 DDoS 攻击

4. ❌ **缺少审计日志**
   - 无法追踪认证操作
   - 不利于安全审计

5. ❌ **Session 无法管理**
   - 只存储在 Redis
   - 无法查看活跃 session
   - 无法强制登出所有设备

### 14.2 架构问题

6. ❌ **重复的 OAuth 实现**
   - AuthService vs GitHubOAuthService/GitLabOAuthService
   - ~400 行重复代码
   - 维护成本高

7. ❌ **重复的 Git Connection 服务**
   - GitConnectionsService vs GitAccountLinkingService
   - 功能 90% 重复
   - 混淆开发者

8. ❌ **未使用的代码**
   - GitHubOAuthService: 完全未使用
   - GitLabOAuthService: 完全未使用
   - 增加代码库复杂度

9. ❌ **不一致的实现**
   - AuthService 使用 Arctic（现代）
   - GitHubOAuthService 使用 axios（手动）
   - 技术栈不统一

10. ❌ **git-sync router 的混乱**
    - 注入了 GitAccountLinkingService
    - 但实际 OAuth 流程在 AuthService 中
    - linkGitAccount endpoint 永远不会被调用（因为 OAuth 已经在 AuthService 中完成）

### 14.3 数据一致性问题

11. ❌ **多服务器支持不完整**
    - GitConnectionsService 支持多服务器
    - GitAccountLinkingService 不支持
    - 导致功能不一致

12. ❌ **查询方式不统一**
    - GitConnectionsService 使用 `where(and(...))`
    - GitAccountLinkingService 使用 `query.findFirst()`
    - 代码风格不一致

---

## 15. 推荐的清理方案

### 15.1 立即删除（无风险）

**删除未使用的 OAuth 服务**:
```bash
# 删除文件
rm packages/services/foundation/src/git-accounts/github-oauth.service.ts
rm packages/services/foundation/src/git-accounts/gitlab-oauth.service.ts

# 更新 git-accounts.module.ts
# 移除 GitHubOAuthService 和 GitLabOAuthService

# 更新 index.ts
# 移除相关导出
```

**影响**: 无，这些服务完全未被使用

### 15.2 合并重复服务（中等风险）

**方案 A: 使用 GitConnectionsService，删除 GitAccountLinkingService**

优点:
- 代码更简洁
- 支持多服务器
- 与 AuthService 一致

缺点:
- 需要添加 Token 加密功能
- 需要更新 git-sync router

**方案 B: 使用 GitAccountLinkingService，删除 GitConnectionsService**

优点:
- 已经有 Token 加密
- git-sync router 无需修改

缺点:
- 不支持多服务器
- 需要更新 AuthService
- 查询方式不统一

**推荐**: 方案 A（使用 GitConnectionsService）

### 15.3 统一 Token 加密（高优先级）

**步骤**:
1. 在 GitConnectionsService 中添加 Token 加密
2. 更新 AuthService 使用加密后的 Token
3. 迁移现有数据（明文 → 密文）
4. 删除 GitAccountLinkingService

### 15.4 清理 git-sync router（低风险）

**问题**: linkGitAccount endpoint 永远不会被调用

**原因**:
- OAuth 流程在 AuthService 中完成
- 用户登录时自动创建 Git Connection
- 无需手动关联

**方案**:
- 删除 linkGitAccount endpoint
- 或者重新设计为"连接额外账户"功能

---

## 16. 实施计划

### Phase 1: 清理未使用代码（1 天）

- [ ] 删除 GitHubOAuthService
- [ ] 删除 GitLabOAuthService
- [ ] 更新 git-accounts.module.ts
- [ ] 更新 index.ts 导出
- [ ] 运行测试确保无影响

### Phase 2: 统一 Token 加密（2-3 天）

- [ ] 在 GitConnectionsService 中添加 Token 加密
- [ ] 更新 AuthService 使用加密
- [ ] 编写数据迁移脚本
- [ ] 迁移现有数据
- [ ] 测试加密/解密功能

### Phase 3: 合并重复服务（2-3 天）

- [ ] 将 GitAccountLinkingService 的功能合并到 GitConnectionsService
- [ ] 更新 git-sync router 使用 GitConnectionsService
- [ ] 删除 GitAccountLinkingService
- [ ] 更新所有引用
- [ ] 运行完整测试

### Phase 4: 增强安全性（3-5 天）

- [ ] 添加 Rate Limiting
- [ ] 添加审计日志
- [ ] 添加 Session 管理表
- [ ] 实现强制登出功能
- [ ] 安全测试

---

## 17. 风险评估

### 低风险
- 删除未使用的 OAuth 服务 ✅
- 添加 Rate Limiting ✅
- 添加审计日志 ✅

### 中等风险
- 统一 Token 加密 ⚠️
  - 需要数据迁移
  - 需要测试加密/解密
  
- 合并重复服务 ⚠️
  - 需要更新多个文件
  - 需要完整测试

### 高风险
- 修改 AuthService 核心逻辑 ⚠️⚠️
  - 影响用户登录
  - 需要充分测试
  - 建议分阶段实施

---

## 18. 总结

### 当前状态
- ❌ 代码冗余严重（~400 行重复代码）
- ❌ Token 加密不一致（明文 + 密文混合）
- ❌ 架构混乱（两套 OAuth 实现，两个 Git Connection 服务）
- ❌ 安全隐患（明文存储 Token，无 Rate Limiting，无审计日志）

### 改进后
- ✅ 代码简洁（删除 ~400 行冗余代码）
- ✅ Token 统一加密（所有 Token 都加密存储）
- ✅ 架构清晰（单一 OAuth 实现，单一 Git Connection 服务）
- ✅ 安全增强（Token 加密，Rate Limiting，审计日志）

### 工作量估算
- Phase 1: 1 天
- Phase 2: 2-3 天
- Phase 3: 2-3 天
- Phase 4: 3-5 天
- **总计: 8-12 天**

### 优先级
1. **高**: 统一 Token 加密（安全问题）
2. **高**: 删除未使用代码（降低复杂度）
3. **中**: 合并重复服务（提高可维护性）
4. **中**: 添加 Rate Limiting 和审计日志（安全增强）
5. **低**: 添加 Session 管理（用户体验）
