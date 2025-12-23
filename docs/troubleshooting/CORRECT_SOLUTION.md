# 正确的镜像拉取解决方案（最终版本）

## 核心原则

✅ **只用 ImagePullSecret，每个用户用自己的 Token**

---

## 为什么之前的方案是错的？

### ❌ 错误方案 1：配置 K3s registries.yaml

```yaml
# /etc/rancher/k3s/registries.yaml
configs:
  "ghcr.io":
    auth:
      username: "997899594"
      password: "ghp_xxxxx"
```

**问题**:
1. 需要重启 K3s（影响所有应用）
2. 只能配置一个 Token（不支持多用户）
3. 所有项目共享认证（安全问题）
4. 每次创建项目都要重启？（太蠢了）

### ❌ 错误方案 2：使用环境变量的 Token

```typescript
const githubToken = this.config.get<string>('GITHUB_PACKAGES_TOKEN')
const username = '997899594' // 硬编码
```

**问题**:
1. 所有用户共享一个 Token
2. 用户无法拉取自己的私有镜像
3. 不支持多用户场景

### ❌ 错误方案 3：过度设计的监控服务

- `DeploymentHealthService`: 每 5 分钟定时检查
- `ImagePullMonitorService`: 自动修复
- **问题**: 浪费资源，大部分问题需要人工介入

---

## ✅ 正确方案：ImagePullSecret + 用户 Token

### 1. 每个命名空间创建自己的 Secret（使用用户的 Token）

```typescript
// 获取用户的 GitHub 连接信息
const gitConnection = await this.db.query.gitConnections.findFirst({
  where: (gitConnections, { and, eq }) =>
    and(
      eq(gitConnections.userId, userId),
      eq(gitConnections.provider, 'github')
    ),
})

// 使用用户自己的 Token 创建 Secret
await this.createImagePullSecret(
  namespace,
  gitConnection.username,  // 用户的 GitHub 用户名
  gitConnection.accessToken // 用户的 GitHub Token
)
```

### 2. Deployment 引用 Secret

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-secret
      containers:
        - name: app
          image: ghcr.io/<user-github-username>/<repository>:latest
```

### 3. 完成！

- ✅ 不需要重启任何东西
- ✅ 每个用户用自己的 Token
- ✅ 命名空间隔离
- ✅ 支持多用户

---

## TLS 证书问题怎么办？

### 问题
中国网络环境的 DNS 污染导致 `ghcr.io` 解析错误，TLS 证书验证失败。

### 解决方案

#### 方案 1: 将镜像设为 Public（临时）
```bash
# 在 GitHub 上设置镜像为 Public
# 优点: 简单快速
# 缺点: 镜像公开可见
```

#### 方案 2: 使用国内镜像仓库（推荐）
```yaml
# 阿里云
image: registry.cn-hangzhou.aliyuncs.com/<namespace>/<repository>:latest

# 腾讯云
image: ccr.ccs.tencentyun.com/<namespace>/<repository>:latest
```

#### 方案 3: 配置 CoreDNS
```bash
# 编辑 CoreDNS ConfigMap
kubectl edit configmap coredns -n kube-system

# 添加正确的 hosts 记录
hosts {
  140.82.112.1 ghcr.io
  fallthrough
}

# 重启 CoreDNS
kubectl rollout restart deployment coredns -n kube-system
```

---

## 代码实现

### 项目初始化时自动创建 ImagePullSecret

```typescript
// packages/services/business/src/gitops/flux/flux-resources.service.ts

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

    // 创建命名空间
    await this.k3s.createNamespace(namespace)

    // 创建 ImagePullSecret（使用用户的 Token）
    if (githubUsername && githubToken) {
      await this.createImagePullSecret(namespace, githubUsername, githubToken)
    }

    // 部署 K8s 资源
    await this.k3s.applyManifests(namespace, manifests)
  }
}

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

  const dockerConfigJson = {
    auths: {
      [registryHost]: {
        username: githubUsername,
        password: githubToken,
        auth: Buffer.from(`${githubUsername}:${githubToken}`).toString('base64'),
      },
    },
  }

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

---

## 多用户支持

### 场景
- 用户 A: `ghcr.io/userA/project1`
- 用户 B: `ghcr.io/userB/project2`

### 实现
```
命名空间 A:
  └─ Secret: ghcr-secret (userA 的 Token)
     └─ Deployment: project1
        └─ Image: ghcr.io/userA/project1

命名空间 B:
  └─ Secret: ghcr-secret (userB 的 Token)
     └─ Deployment: project2
        └─ Image: ghcr.io/userB/project2
```

**完美隔离，互不影响！** ✅

---

## 总结

**不要折腾 K3s 配置，ImagePullSecret 就够了！**

- ✅ 简单
- ✅ 可靠
- ✅ 支持多用户
- ✅ 不需要重启任何东西
- ✅ 每个用户用自己的 Token

**记住**: 
- 每个命名空间有自己的 ImagePullSecret
- 每个用户用自己的 GitHub Token
- 不要共享认证信息
- 不要重启 K3s
- 不要过度设计（删除了定时任务和自动修复服务）

## 已删除的文件

- ~~`packages/services/business/src/deployments/deployment-health.service.ts`~~ - 定时健康检查（过度设计）
- ~~`packages/services/business/src/deployments/image-pull-monitor.service.ts`~~ - 自动修复（过度设计）
- ~~`scripts/setup-k3s-ghcr-registry.sh`~~ - K3s 配置脚本（错误方案）
- ~~`scripts/auto-deploy-project.sh`~~ - 自动部署脚本（错误方案）
- ~~`docs/guides/k3s-ghcr-setup-once.md`~~ - K3s 配置文档（错误方案）

## 相关文档

- `docs/troubleshooting/imagepullsecret-multi-user-fix.md` - 详细的修复记录
- `docs/troubleshooting/ghcr-imagepull-authentication-issue.md` - 原始问题记录

