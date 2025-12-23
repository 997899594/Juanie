# ImagePullSecret 多用户支持修复

## 问题描述

之前的实现存在严重的设计缺陷：

### ❌ 错误的实现

1. **使用环境变量的 Token**
   ```typescript
   const githubToken = this.config.get<string>('GITHUB_PACKAGES_TOKEN')
   const username = registryUrl.split('/')[1] || '997899594'
   ```
   - 所有用户共享一个 Token
   - 用户无法拉取自己的私有镜像
   - 不支持多用户场景

2. **过度设计的监控服务**
   - `DeploymentHealthService`: 每 5 分钟定时检查所有部署
   - `ImagePullMonitorService`: 自动修复镜像拉取问题
   - 问题: 浪费资源，大部分问题需要人工介入

3. **混乱的逻辑**
   - 既检查 K3s `registries.yaml` 配置
   - 又检查 ImagePullSecret
   - 还尝试重新创建 Secret（但用的是环境变量的 Token）

## 修复方案

### ✅ 正确的实现

#### 1. 使用用户自己的 GitHub Token

```typescript
/**
 * 创建 ImagePullSecret（用于从 ghcr.io 拉取镜像）
 * 使用用户自己的 GitHub Token，支持多用户
 */
private async createImagePullSecret(
  namespace: string,
  githubUsername: string,
  githubToken: string,
): Promise<void> {
  const registryHost = 'ghcr.io'

  // 创建 Docker config JSON
  const dockerConfigJson = {
    auths: {
      [registryHost]: {
        username: githubUsername,
        password: githubToken,
        auth: Buffer.from(`${githubUsername}:${githubToken}`).toString('base64'),
      },
    },
  }

  // 创建 Secret
  await this.k3s.createSecret(
    namespace,
    'ghcr-secret',
    {
      '.dockerconfigjson': JSON.stringify(dockerConfigJson),
    },
    'kubernetes.io/dockerconfigjson',
  )
}
```

#### 2. 在项目初始化时获取用户的 Git 连接信息

```typescript
async setupProjectGitOps(data: {
  projectId: string
  userId: string
  // ...
}): Promise<...> {
  // 1. 获取用户的 GitHub 连接信息
  const gitConnection = await this.db.query.gitConnections.findFirst({
    where: (gitConnections, { and, eq }) =>
      and(
        eq(gitConnections.userId, userId),
        eq(gitConnections.provider, 'github')
      ),
  })

  let githubUsername: string | null = null
  let githubToken: string | null = null

  if (gitConnection?.username && gitConnection.accessToken) {
    githubUsername = gitConnection.username
    githubToken = await this.decryptToken(gitConnection.accessToken)
  }

  // 2. 为每个环境创建 ImagePullSecret
  for (const environment of environments) {
    const namespace = `project-${projectId}-${environment.type}`

    if (githubUsername && githubToken) {
      await this.createImagePullSecret(namespace, githubUsername, githubToken)
    }
  }
}
```

#### 3. 删除过度设计的服务

- ❌ 删除 `DeploymentHealthService`（定时任务）
- ❌ 删除 `ImagePullMonitorService`（自动修复）
- ✅ 保留 `DeploymentsService`（基础查询功能）

## 多用户支持

### 场景示例

```
用户 A (GitHub: userA):
  命名空间: project-xxx-development
    └─ Secret: ghcr-secret (userA 的 Token)
       └─ Deployment: app
          └─ Image: ghcr.io/userA/project:latest

用户 B (GitHub: userB):
  命名空间: project-yyy-development
    └─ Secret: ghcr-secret (userB 的 Token)
       └─ Deployment: app
          └─ Image: ghcr.io/userB/project:latest
```

**完美隔离，互不影响！** ✅

## 核心原则

1. **每个用户用自己的 Token** - 不共享认证信息
2. **命名空间隔离** - 每个项目有自己的 Secret
3. **不重启任何东西** - ImagePullSecret 是命名空间级别的
4. **不过度设计** - 用户主动查看状态，不需要定时任务

## 相关文件

- `packages/services/business/src/gitops/flux/flux-resources.service.ts` - 修复 ImagePullSecret 创建逻辑
- `packages/services/business/src/deployments/deployments.module.ts` - 删除过度设计的服务
- ~~`packages/services/business/src/deployments/deployment-health.service.ts`~~ - 已删除
- ~~`packages/services/business/src/deployments/image-pull-monitor.service.ts`~~ - 已删除

## 总结

**不要折腾 K3s 配置，ImagePullSecret 就够了！**

- ✅ 简单
- ✅ 可靠
- ✅ 支持多用户
- ✅ 不需要重启任何东西
- ✅ 每个用户用自己的 Token
