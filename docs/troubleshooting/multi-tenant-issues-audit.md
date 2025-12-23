# 多租户问题审计和修复

## 发现的问题

### 🔴 严重问题

#### 1. K8s Deployment 硬编码镜像仓库用户名

**文件**: `templates/nextjs-15-app/k8s/base/deployment.yaml`

```yaml
# ❌ 错误：硬编码了 997899594
image: ghcr.io/997899594/<%= projectSlug %>:latest

# ✅ 正确：使用用户的 GitHub 用户名
image: ghcr.io/<%= githubUsername %>/<%= projectSlug %>:latest
```

**影响**:
- 所有用户的项目都会尝试从 `ghcr.io/997899594` 拉取镜像
- 用户无法拉取自己的镜像
- 多租户完全不工作

**修复**: 在模板变量中添加 `githubUsername`

---

#### 2. 模板变量缺少 GitHub 用户名

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

```typescript
// ❌ 错误：没有传递 GitHub 用户名
const templateVariables = {
  projectId: project.id,
  projectSlug: project.slug,
  registry: this.config.get('REGISTRY_URL') || 'ghcr.io',
  // 缺少 githubUsername!
}

// ✅ 正确：传递用户的 GitHub 用户名
const templateVariables = {
  projectId: project.id,
  projectSlug: project.slug,
  githubUsername: gitConnection.username, // 用户的 GitHub 用户名
  registry: 'ghcr.io', // 固定为 ghcr.io
}
```

**影响**:
- 模板渲染时无法获取用户的 GitHub 用户名
- 导致镜像路径错误

**修复**: 从 `gitConnection` 获取用户名并传递给模板

---

### 🟡 次要问题

#### 3. 测试脚本硬编码用户名

**文件**: 
- `scripts/cleanup-github-repos.ts`
- `scripts/cleanup-test-repositories.ts`
- `scripts/test-template-ejs-render.ts`
- `scripts/test-k8s-template-render.ts`

```typescript
// ❌ 硬编码
const REPO_OWNER = '997899594'
const GITHUB_USERNAME = '997899594'
registry: 'ghcr.io/997899594'
```

**影响**:
- 测试脚本只能用于开发者自己的账号
- 其他开发者无法运行这些脚本

**修复**: 
- 从环境变量读取：`process.env.GITHUB_USERNAME`
- 或者从 Git 配置读取：`git config user.name`

---

## 修复方案

### 1. 修复 K8s Deployment 模板

```yaml
# templates/nextjs-15-app/k8s/base/deployment.yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: ghcr-secret
      containers:
      - name: <%= projectSlug %>
        image: ghcr.io/<%= githubUsername %>/<%= projectSlug %>:latest
```

### 2. 修复模板变量传递

```typescript
// packages/services/business/src/queue/project-initialization.worker.ts

// 获取用户的 GitHub 连接信息
const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
  userId,
  provider as 'github' | 'gitlab',
)

const templateVariables = {
  // 项目信息
  projectId: project.id,
  projectName: project.name,
  projectSlug: project.slug,
  
  // GitHub 信息（用于镜像路径）
  githubUsername: gitConnection?.username || 'unknown',
  
  // K8s 配置
  appName: project.slug,
  registry: 'ghcr.io', // 固定为 ghcr.io
  port: 3000,
  domain: this.config.get('APP_DOMAIN') || 'example.com',
  replicas: 1,
  
  // ... 其他配置
}
```

### 3. 更新环境变量文档

```bash
# .env.example

# ============================================
# 容器镜像仓库配置
# ============================================
# GitHub Container Registry（固定）
REGISTRY_URL=ghcr.io

# ⚠️  注意：不要在这里配置用户名！
# 用户名会从用户的 Git 连接信息中自动获取
# 每个用户使用自己的 GitHub 用户名和 Token
```

---

## 验证清单

- [ ] K8s Deployment 使用 `<%= githubUsername %>`
- [ ] 模板变量包含 `githubUsername`
- [ ] ImagePullSecret 使用用户的 Token
- [ ] GitHub Actions 使用 `${{ github.repository_owner }}`
- [ ] 测试脚本从环境变量读取用户名
- [ ] 文档更新，说明多租户支持

---

## 测试场景

### 场景 1: 用户 A 创建项目

```
用户: userA
GitHub: github.com/userA
Token: ghp_xxxA

创建项目 "my-app"
  ↓
生成仓库: github.com/userA/my-app
  ↓
GitHub Actions 构建镜像: ghcr.io/userA/my-app:latest
  ↓
K8s Deployment 拉取镜像: ghcr.io/userA/my-app:latest
  ↓
使用 ImagePullSecret (userA 的 Token)
  ↓
✅ 成功部署
```

### 场景 2: 用户 B 创建项目

```
用户: userB
GitHub: github.com/userB
Token: ghp_xxxB

创建项目 "another-app"
  ↓
生成仓库: github.com/userB/another-app
  ↓
GitHub Actions 构建镜像: ghcr.io/userB/another-app:latest
  ↓
K8s Deployment 拉取镜像: ghcr.io/userB/another-app:latest
  ↓
使用 ImagePullSecret (userB 的 Token)
  ↓
✅ 成功部署
```

### 场景 3: 用户 A 和 B 的项目互不影响

```
命名空间 A: project-xxx-development
  └─ Secret: ghcr-secret (userA 的 Token)
     └─ Deployment: my-app
        └─ Image: ghcr.io/userA/my-app:latest

命名空间 B: project-yyy-development
  └─ Secret: ghcr-secret (userB 的 Token)
     └─ Deployment: another-app
        └─ Image: ghcr.io/userB/another-app:latest
```

**完美隔离！** ✅

---

## 总结

**核心原则**:
1. ✅ 每个用户用自己的 GitHub 用户名
2. ✅ 每个用户用自己的 GitHub Token
3. ✅ 镜像路径包含用户名：`ghcr.io/<username>/<project>`
4. ✅ ImagePullSecret 使用用户的 Token
5. ✅ 命名空间隔离

**不要**:
- ❌ 硬编码用户名
- ❌ 共享 Token
- ❌ 使用全局配置
- ❌ 假设所有用户都是同一个人
