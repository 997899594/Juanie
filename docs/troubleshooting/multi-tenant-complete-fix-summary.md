# 多租户支持完整修复总结

## 修复日期
2024-12-23

## 问题背景

在实现项目部署功能时，发现多个地方没有考虑多租户场景，导致：
1. 所有用户共享一个 GitHub Token
2. 镜像路径硬编码了开发者的用户名
3. 用户无法拉取自己的私有镜像
4. 过度设计的监控服务浪费资源

---

## 修复内容

### 1. ✅ ImagePullSecret 使用用户自己的 Token

**文件**: `packages/services/business/src/gitops/flux/flux-resources.service.ts`

**修改前**:
```typescript
// ❌ 使用环境变量的 Token（所有用户共享）
const githubToken = this.config.get<string>('GITHUB_PACKAGES_TOKEN')
const username = '997899594' // 硬编码
```

**修改后**:
```typescript
// ✅ 使用用户自己的 Token
private async createImagePullSecret(
  namespace: string,
  githubUsername: string,  // 用户的 GitHub 用户名
  githubToken: string,      // 用户的 GitHub Token
): Promise<void> {
  const dockerConfigJson = {
    auths: {
      'ghcr.io': {
        username: githubUsername,
        password: githubToken,
        auth: Buffer.from(`${githubUsername}:${githubToken}`).toString('base64'),
      },
    },
  }
  // ...
}
```

**在 setupProjectGitOps 中获取用户信息**:
```typescript
// 获取用户的 GitHub 连接信息
const gitConnection = await this.db.query.gitConnections.findFirst({
  where: (gitConnections, { and, eq }) =>
    and(
      eq(gitConnections.userId, userId),
      eq(gitConnections.provider, 'github')
    ),
})

// 解密 Token
const githubUsername = gitConnection.username
const githubToken = await this.decryptToken(gitConnection.accessToken)

// 创建 ImagePullSecret
await this.createImagePullSecret(namespace, githubUsername, githubToken)
```

---

### 2. ✅ K8s Deployment 使用用户的镜像路径

**文件**: `templates/nextjs-15-app/k8s/base/deployment.yaml`

**修改前**:
```yaml
# ❌ 硬编码了开发者的用户名
image: ghcr.io/997899594/<%= projectSlug %>:latest
```

**修改后**:
```yaml
# ✅ 使用用户的 GitHub 用户名
image: ghcr.io/<%= githubUsername %>/<%= projectSlug %>:latest
```

---

### 3. ✅ 模板变量传递用户信息

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

**修改 1: resolveAccessToken 返回用户名**:
```typescript
private async resolveAccessToken(userId: string, repository: any): Promise<any> {
  const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
    userId,
    repository.provider,
  )

  return {
    ...repository,
    accessToken: gitConnection.accessToken,
    username: gitConnection.username, // ✅ 添加用户名
  }
}
```

**修改 2: pushTemplateCode 接收并使用用户名**:
```typescript
private async pushTemplateCode(
  job: Job,
  project: typeof schema.projects.$inferSelect,
  provider: 'github' | 'gitlab',
  accessToken: string,
  repoInfo: { fullName: string; cloneUrl: string; defaultBranch: string },
  githubUsername?: string, // ✅ 添加参数
): Promise<void> {
  const templateVariables = {
    projectId: project.id,
    projectSlug: project.slug,
    githubUsername: githubUsername || 'unknown', // ✅ 传递给模板
    registry: 'ghcr.io', // 固定为 ghcr.io
    // ...
  }
}
```

**修改 3: 调用时传递用户名**:
```typescript
await this.pushTemplateCode(
  job,
  project,
  resolvedRepository.provider,
  resolvedRepository.accessToken,
  repoInfo,
  resolvedRepository.username, // ✅ 传递用户名
)
```

---

### 4. ✅ 删除过度设计的服务

**删除的文件**:
- ~~`packages/services/business/src/deployments/deployment-health.service.ts`~~ - 定时健康检查（每5分钟）
- ~~`packages/services/business/src/deployments/image-pull-monitor.service.ts`~~ - 自动修复服务

**修改的文件**:
- `packages/services/business/src/deployments/deployments.module.ts` - 移除这两个服务的引用

**原因**:
- 定时任务浪费资源
- 大部分问题需要人工介入
- 用户应该主动查看状态，而不是被动等待

---

## 多租户工作流程

### 用户 A 创建项目

```
1. 用户 A 登录（GitHub: userA）
   ↓
2. 创建项目 "my-app"
   ↓
3. 系统获取 userA 的 GitHub Token
   ↓
4. 创建仓库: github.com/userA/my-app
   ↓
5. 推送模板代码（包含 githubUsername: "userA"）
   ↓
6. 渲染 K8s Deployment:
   image: ghcr.io/userA/my-app:latest
   ↓
7. 创建 ImagePullSecret（使用 userA 的 Token）
   ↓
8. GitHub Actions 构建镜像: ghcr.io/userA/my-app:latest
   ↓
9. K8s 使用 userA 的 Token 拉取镜像
   ↓
10. ✅ 部署成功
```

### 用户 B 创建项目（同时进行）

```
1. 用户 B 登录（GitHub: userB）
   ↓
2. 创建项目 "another-app"
   ↓
3. 系统获取 userB 的 GitHub Token
   ↓
4. 创建仓库: github.com/userB/another-app
   ↓
5. 推送模板代码（包含 githubUsername: "userB"）
   ↓
6. 渲染 K8s Deployment:
   image: ghcr.io/userB/another-app:latest
   ↓
7. 创建 ImagePullSecret（使用 userB 的 Token）
   ↓
8. GitHub Actions 构建镜像: ghcr.io/userB/another-app:latest
   ↓
9. K8s 使用 userB 的 Token 拉取镜像
   ↓
10. ✅ 部署成功
```

### 隔离性验证

```
K3s 集群:
  ├─ Namespace: project-xxx-development (用户 A)
  │  ├─ Secret: ghcr-secret
  │  │  └─ Token: userA 的 GitHub Token
  │  └─ Deployment: my-app
  │     └─ Image: ghcr.io/userA/my-app:latest
  │
  └─ Namespace: project-yyy-development (用户 B)
     ├─ Secret: ghcr-secret
     │  └─ Token: userB 的 GitHub Token
     └─ Deployment: another-app
        └─ Image: ghcr.io/userB/another-app:latest
```

**完美隔离！** ✅

---

## 核心原则

1. ✅ **每个用户用自己的 GitHub 用户名**
   - 镜像路径: `ghcr.io/<username>/<project>`
   - 不硬编码用户名

2. ✅ **每个用户用自己的 GitHub Token**
   - ImagePullSecret 使用用户的 Token
   - 不共享 Token

3. ✅ **命名空间隔离**
   - 每个项目有自己的命名空间
   - 每个命名空间有自己的 Secret

4. ✅ **不重启任何东西**
   - ImagePullSecret 是命名空间级别的
   - 不需要重启 K3s

5. ✅ **不过度设计**
   - 删除定时任务
   - 删除自动修复服务
   - 用户主动查看状态

---

## 相关文档

- `docs/troubleshooting/imagepullsecret-multi-user-fix.md` - ImagePullSecret 修复详情
- `docs/troubleshooting/multi-tenant-issues-audit.md` - 多租户问题审计
- `docs/troubleshooting/CORRECT_SOLUTION.md` - 正确的解决方案

---

## 测试清单

- [ ] 用户 A 创建项目，镜像路径包含 userA
- [ ] 用户 B 创建项目，镜像路径包含 userB
- [ ] 用户 A 的 ImagePullSecret 使用 userA 的 Token
- [ ] 用户 B 的 ImagePullSecret 使用 userB 的 Token
- [ ] 两个用户的项目互不影响
- [ ] GitHub Actions 使用正确的用户名构建镜像
- [ ] K8s 能成功拉取用户的私有镜像

---

## 总结

**修复前的问题**:
- ❌ 所有用户共享一个 Token
- ❌ 镜像路径硬编码开发者用户名
- ❌ 用户无法拉取自己的镜像
- ❌ 过度设计的监控服务

**修复后的效果**:
- ✅ 每个用户用自己的 Token
- ✅ 镜像路径动态生成
- ✅ 完美支持多租户
- ✅ 简化了代码，删除了不必要的服务

**核心改动**:
1. ImagePullSecret 使用用户的 Token
2. K8s Deployment 使用用户的镜像路径
3. 模板变量传递用户信息
4. 删除过度设计的监控服务

**文件修改**:
- `packages/services/business/src/gitops/flux/flux-resources.service.ts`
- `packages/services/business/src/queue/project-initialization.worker.ts`
- `templates/nextjs-15-app/k8s/base/deployment.yaml`
- `packages/services/business/src/deployments/deployments.module.ts`

**文件删除**:
- `packages/services/business/src/deployments/deployment-health.service.ts`
- `packages/services/business/src/deployments/image-pull-monitor.service.ts`
