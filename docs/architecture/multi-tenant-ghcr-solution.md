# 多租户 GitHub Container Registry 解决方案

**日期**: 2024-12-24  
**场景**: 每个用户使用自己的 GitHub 账号推送镜像到 ghcr.io  
**目标**: 支持多租户，每个用户独立管理镜像

## 多租户架构

### 当前架构

```
用户 A → GitHub 账号 A → ghcr.io/user-a/project-1
用户 B → GitHub 账号 B → ghcr.io/user-b/project-2
用户 C → GitHub 账号 C → ghcr.io/user-c/project-3
```

**关键点**:
- ✅ 每个用户使用自己的 GitHub 账号
- ✅ 镜像推送到用户自己的 ghcr.io 命名空间
- ✅ 平台不需要管理镜像仓库
- ✅ 用户完全控制自己的镜像

### 问题分析

**TLS 证书问题是 K3s 节点的问题，与多租户无关**：
- 问题：K3s 节点无法验证 ghcr.io 的证书
- 影响：所有用户的镜像都无法拉取
- 解决：修复 K3s 节点的 CA 证书（一次性，全局生效）

---

## 正确的解决方案

### 第一步：修复 K3s 节点（全局，一次性）

这是**基础设施问题**，不是多租户问题。

```bash
# 在 K3s 节点上执行（只需执行一次）
ssh root@49.232.237.136 << 'EOF'
# 更新 CA 证书
apt-get update
apt-get install -y ca-certificates
update-ca-certificates --fresh

# 同步时间
apt-get install -y ntp
ntpdate -u pool.ntp.org
timedatectl set-ntp true

# 重启服务
systemctl restart containerd
systemctl restart k3s
EOF
```

**修复后**：
- ✅ 所有用户的 ghcr.io 镜像都能正常拉取
- ✅ 无需为每个用户单独配置
- ✅ 支持任意 GitHub 用户的镜像

---

### 第二步：多租户 ImagePullSecret 管理

每个用户需要自己的 GitHub Token 来拉取私有镜像。

#### 当前实现（已有）

```typescript
// packages/services/business/src/gitops/credentials/credentials.service.ts

async syncGitCredentialsToNamespace(
  namespace: string,
  userId: string,
): Promise<void> {
  // 1. 获取用户的 Git 连接（包含 GitHub Token）
  const gitConnection = await this.gitConnectionsService.findByUserId(userId)
  
  if (!gitConnection) {
    throw new Error('User has no Git connection')
  }

  // 2. 创建 Docker Config（用于拉取镜像）
  const dockerConfig = {
    auths: {
      'ghcr.io': {
        username: gitConnection.username,  // GitHub 用户名
        password: gitConnection.accessToken,  // GitHub Token
        auth: Buffer.from(
          `${gitConnection.username}:${gitConnection.accessToken}`
        ).toString('base64'),
      },
    },
  }

  // 3. 创建 ImagePullSecret
  await this.k3sService.createSecret(namespace, {
    metadata: {
      name: 'ghcr-secret',
      namespace,
    },
    type: 'kubernetes.io/dockerconfigjson',
    data: {
      '.dockerconfigjson': Buffer.from(
        JSON.stringify(dockerConfig)
      ).toString('base64'),
    },
  })
}
```

#### 验证当前实现

```typescript
// 检查 ImagePullSecret 是否正确创建
async function checkImagePullSecret() {
  const namespace = 'project-a5ca948d-2db3-437e-8504-bc7cc956013e-development'
  
  // 获取 Secret
  const secret = await k3sService.getSecret(namespace, 'ghcr-secret')
  
  // 解码查看内容
  const dockerConfigJson = Buffer.from(
    secret.data['.dockerconfigjson'],
    'base64'
  ).toString('utf-8')
  
  console.log('Docker Config:', JSON.parse(dockerConfigJson))
  // 应该输出:
  // {
  //   "auths": {
  //     "ghcr.io": {
  //       "username": "997899594",
  //       "password": "ghp_xxx...",
  //       "auth": "OTk3ODk5NTk0OmdocF94eHg..."
  //     }
  //   }
  // }
}
```

---

## 多租户最佳实践

### 1. 镜像命名规范

每个用户的镜像使用自己的 GitHub 用户名作为命名空间：

```yaml
# 用户 A 的项目
image: ghcr.io/user-a/project-name:tag

# 用户 B 的项目
image: ghcr.io/user-b/project-name:tag

# 用户 C 的项目
image: ghcr.io/user-c/project-name:tag
```

**优势**:
- ✅ 自然隔离（GitHub 用户级别）
- ✅ 权限清晰（用户只能访问自己的镜像）
- ✅ 无需平台管理镜像仓库

### 2. GitHub Token 权限

用户的 GitHub Token 需要以下权限：

```
✅ read:packages  - 拉取镜像
✅ write:packages - 推送镜像
✅ delete:packages - 删除镜像（可选）
```

**获取方式**:
1. GitHub Settings → Developer settings → Personal access tokens
2. 选择 "Tokens (classic)"
3. 勾选 `write:packages` 和 `read:packages`
4. 生成 Token

### 3. 自动化流程

```typescript
// 项目初始化时自动配置
async function initializeProject(projectId: string, userId: string) {
  // 1. 获取用户的 GitHub 信息
  const gitConnection = await getGitConnection(userId)
  
  // 2. 生成镜像地址（使用用户的 GitHub 用户名）
  const imageUrl = `ghcr.io/${gitConnection.username}/${projectName}`
  
  // 3. 创建 K8s 命名空间
  const namespace = `project-${projectId}-development`
  await k3sService.createNamespace(namespace)
  
  // 4. 同步 ImagePullSecret（用户的 GitHub Token）
  await credentialsService.syncGitCredentialsToNamespace(namespace, userId)
  
  // 5. 创建 Deployment（使用用户的镜像地址）
  await k3sService.createDeployment(namespace, {
    spec: {
      template: {
        spec: {
          containers: [{
            image: imageUrl,
          }],
          imagePullSecrets: [{
            name: 'ghcr-secret',  // 用户自己的 Token
          }],
        },
      },
    },
  })
}
```

---

## 常见问题

### Q1: 如果用户的 GitHub Token 过期了怎么办？

**方案 A: 自动检测和提醒**

```typescript
async function checkTokenValidity(userId: string) {
  const gitConnection = await getGitConnection(userId)
  
  // 测试 Token 是否有效
  try {
    await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${gitConnection.accessToken}`,
      },
    })
    return { valid: true }
  } catch (error) {
    // Token 无效，通知用户
    await notifyUser(userId, {
      type: 'token_expired',
      message: 'Your GitHub token has expired. Please reconnect your GitHub account.',
    })
    return { valid: false }
  }
}
```

**方案 B: 使用 GitHub App（推荐）**

GitHub App 的 Token 可以自动刷新，无需用户手动更新。

```typescript
// 使用 GitHub App 获取 Installation Token
async function getInstallationToken(userId: string) {
  const installation = await getGitHubInstallation(userId)
  
  // GitHub App Token 自动刷新
  const token = await githubApp.getInstallationAccessToken({
    installationId: installation.id,
  })
  
  return token // 有效期 1 小时，自动刷新
}
```

### Q2: 如何支持私有镜像？

**已支持**！当前实现已经支持私有镜像：

1. 用户的 GitHub Token 包含在 ImagePullSecret 中
2. K8s 使用这个 Token 拉取私有镜像
3. 只要用户有权限访问镜像，就能拉取

### Q3: 如何防止用户拉取其他用户的镜像？

**GitHub 自动隔离**：

- 用户 A 的 Token 只能访问用户 A 的镜像
- 用户 B 的 Token 只能访问用户 B 的镜像
- 无需平台额外控制

**额外保护**（可选）：

```typescript
// 验证镜像地址是否属于当前用户
function validateImageOwnership(imageUrl: string, userId: string) {
  const gitConnection = await getGitConnection(userId)
  const expectedPrefix = `ghcr.io/${gitConnection.username}/`
  
  if (!imageUrl.startsWith(expectedPrefix)) {
    throw new Error('You can only use images from your own GitHub account')
  }
}
```

### Q4: 多个用户共享一个项目怎么办？

**方案：使用 GitHub Organization**

```typescript
// 项目属于 Organization
const imageUrl = `ghcr.io/my-org/project-name`

// Organization 成员都可以访问
// 使用任一成员的 Token 都能拉取镜像
```

---

## 实施步骤

### 立即执行（修复 K3s 节点）

```bash
# 1. 修复 K3s 节点的 CA 证书
chmod +x scripts/fix-k3s-ghcr-tls.sh
./scripts/fix-k3s-ghcr-tls.sh

# 2. 验证修复
kubectl --kubeconfig=.kube/k3s-remote.yaml get pods -A
```

### 验证多租户功能

```bash
# 1. 检查用户 A 的项目
kubectl --kubeconfig=.kube/k3s-remote.yaml get secret ghcr-secret \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development \
  -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq

# 2. 创建测试用户 B 的项目
# 应该自动创建新的 ImagePullSecret（用户 B 的 Token）

# 3. 验证隔离性
# 用户 A 的 Token 不能拉取用户 B 的镜像
```

---

## 架构优势

### 当前架构的优势

1. **零运维** - 平台不需要管理镜像仓库
2. **自然隔离** - GitHub 用户级别隔离
3. **权限清晰** - 用户完全控制自己的镜像
4. **成本为零** - 使用 GitHub 免费额度
5. **无限扩展** - 支持任意数量用户

### 与其他方案对比

| 方案 | 运维成本 | 隔离性 | 扩展性 | 成本 |
|------|----------|--------|--------|------|
| **当前方案（ghcr.io）** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费 |
| 平台统一镜像仓库 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 高 |
| 云厂商镜像仓库 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 中 |

---

## 总结

**多租户 + ghcr.io 的正确做法**:

1. ✅ **修复 K3s 节点**（一次性，全局生效）
   - 更新 CA 证书
   - 同步系统时间
   - 重启服务

2. ✅ **保持当前多租户架构**（已经正确）
   - 每个用户使用自己的 GitHub 账号
   - 镜像推送到 `ghcr.io/{username}/{project}`
   - ImagePullSecret 包含用户的 GitHub Token

3. ✅ **无需额外配置**
   - 不需要平台镜像仓库
   - 不需要统一的 Token
   - 不需要复杂的权限管理

**现在执行**:
```bash
./scripts/fix-k3s-ghcr-tls.sh
```

修复后，所有用户的镜像都能正常拉取，多租户隔离自动生效。
