# Git 认证策略指南

## 概述

平台支持多种 Git 认证方式，以满足不同场景的需求。

## 认证方式对比

| 方式 | 适用场景 | 优势 | 劣势 | 状态 |
|------|---------|------|------|------|
| OAuth Token | 个人开发者、小团队 | 简单、快速 | 绑定个人账户 | ✅ 已支持 |
| Project Token | 中型团队、企业 | 权限细粒度 | 配置复杂 | 🚧 规划中 |
| Service Account | 大型组织 | 企业级、审计友好 | 实现复杂 | 📋 未来支持 |

## 当前实现：OAuth Token

### 工作原理

```
1. 用户通过 OAuth2 登录 GitHub/GitLab
2. 平台存储 OAuth access token
3. 创建项目时，使用该 token 访问 Git 仓库
4. Flux CD 使用 HTTPS + Basic Auth 同步代码
```

### 适用场景

✅ **推荐使用**：
- 个人项目
- 小团队（< 10 人）
- 原型验证
- 快速开发

⚠️ **谨慎使用**：
- 中型团队（10-50 人）
- 多人协作项目
- 长期维护的项目

❌ **不推荐**：
- 大型企业
- 严格的安全审计要求
- 组织级别的仓库管理

### 限制和注意事项

#### 1. Token 所有权

**问题**：项目使用创建者的 OAuth token

```typescript
// 场景
用户 A 创建项目 → 使用用户 A 的 token
用户 B 加入项目 → 仍然使用用户 A 的 token

// 风险
用户 A 离职 → 项目无法访问 Git 仓库
用户 A 撤销授权 → 所有项目中断
```

**解决方案**：
- 项目创建者离职前，转移项目所有权
- 定期检查 token 健康状态
- 未来支持 Project Token 方式

#### 2. 权限范围

**GitHub OAuth 权限**：
```typescript
'repo'  // 访问所有仓库（公开和私有）
```

**GitLab OAuth 权限**：
```typescript
'api'   // 完整 API 访问
```

**影响**：
- 平台可以访问用户的所有仓库
- 无法限制到单个仓库
- 安全审计时可能被质疑

**缓解措施**：
- 明确告知用户权限范围
- 提供权限说明文档
- 未来支持 Fine-grained PAT

#### 3. Token 过期

**GitHub**：
- OAuth token 永不过期（除非用户撤销）
- 无需刷新机制

**GitLab**：
- OAuth token 2 小时过期
- 平台自动刷新 ✅
- 刷新后需要更新 K8s Secret（待实现）

### 最佳实践

#### 1. 项目创建

```typescript
// 推荐：使用组织账户创建仓库
const repo = await createRepository({
  name: 'my-project',
  organization: 'my-company',  // 而非个人账户
  visibility: 'private'
})
```

#### 2. 成员管理

```typescript
// 添加项目成员时，提醒 token 所有权
await addProjectMember({
  projectId,
  userId,
  role: 'developer',
  // 提示：项目使用创建者的 Git 凭证
})
```

#### 3. Token 健康检查

```typescript
// 定期检查 token 是否有效
async function checkProjectHealth(projectId: string) {
  const auth = await getProjectAuth(projectId)
  const isValid = await validateToken(auth.token)
  
  if (!isValid) {
    // 通知项目成员
    await notifyTokenExpired(projectId)
  }
}
```

## 未来支持：Project Token

### 工作原理

```
1. 用户创建 Fine-grained PAT（GitHub）或 Project Token（GitLab）
2. 用户在平台配置 token
3. 平台使用该 token 访问特定仓库
4. Token 独立于用户账户
```

### 优势

- ✅ 权限细粒度（限制到单个仓库）
- ✅ 独立管理（不依赖个人账户）
- ✅ 更好的安全性
- ✅ 支持组织级别的仓库

### 配置示例

```typescript
// 创建项目时选择认证方式
const project = await createProject({
  name: 'my-project',
  repository: {
    url: 'https://github.com/company/repo.git',
    authType: 'project_token',
    token: 'ghp_xxxxxxxxxxxx',  // Fine-grained PAT
    scopes: ['contents:read', 'metadata:read']
  }
})
```

## 未来支持：Service Account

### 工作原理

```
1. 创建 GitHub App 或 GitLab Service Account
2. 安装到组织
3. 平台使用 App 凭证访问仓库
4. 完全独立于个人账户
```

### 优势

- ✅ 企业级认证
- ✅ 完整的审计日志
- ✅ 不依赖个人账户
- ✅ 细粒度权限控制
- ✅ 支持多组织

### 适用场景

- 大型企业（> 50 人）
- 严格的安全审计要求
- 多组织管理
- 长期维护的关键项目

## 迁移指南

### 从 OAuth Token 迁移到 Project Token

```typescript
// 1. 创建 Fine-grained PAT
// 访问 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens

// 2. 更新项目认证方式
await updateProjectAuth(projectId, {
  authType: 'project_token',
  token: 'ghp_xxxxxxxxxxxx',
  scopes: ['contents:read']
})

// 3. 验证新 token
await validateProjectAuth(projectId)

// 4. 更新 K8s Secret
await refreshProjectSecrets(projectId)
```

## 常见问题

### Q: 为什么不默认使用 Deploy Key？

A: Deploy Key 使用 SSH 协议（22 端口），在云环境中经常被防火墙阻止。HTTPS (443 端口) 兼容性更好。

### Q: OAuth token 安全吗？

A: OAuth token 存储在数据库中（应该加密），K8s Secret 中是 base64 编码。建议使用 Sealed Secrets 或 External Secrets Operator 增强安全性。

### Q: 如何处理成员离职？

A: 
1. 如果离职成员是项目创建者，需要转移项目所有权
2. 未来支持 Project Token 后，可以使用独立的凭证
3. 企业场景建议使用 Service Account

### Q: 可以限制 token 权限吗？

A: 
- OAuth token 权限是固定的（repo 或 api）
- 未来支持 Fine-grained PAT，可以限制到单个仓库
- Service Account 支持最细粒度的权限控制

## 相关文档

- [OAuth Token 优化方案](../troubleshooting/flux/oauth-token-optimization.md)
- [OAuth Token 深度分析](../troubleshooting/flux/oauth-token-analysis.md)
- [Flux GitOps 配置](./flux-installation.md)

## 总结

**当前阶段**：使用 OAuth Token 是最快速、最简单的方案，适合 MVP 和早期用户。

**未来规划**：根据用户反馈和需求，逐步添加 Project Token 和 Service Account 支持。

**建议**：
- 个人项目：使用 OAuth Token ✅
- 小团队：使用 OAuth Token，注意限制 ⚠️
- 企业用户：等待 Project Token 支持 📋
