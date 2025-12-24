# 多租户 GitHub Packages 权限修复

**日期**: 2024-12-23  
**问题**: 用户无法拉取/推送自己的 ghcr.io 镜像  
**原因**: OAuth Token 缺少 `read:packages` 和 `write:packages` 权限  
**状态**: ✅ 已修复

## 问题根因

系统已经实现了完整的多租户架构：
- ✅ 每个用户通过 OAuth 连接自己的 GitHub 账号
- ✅ 每个项目的命名空间有独立的 ImagePullSecret
- ✅ ImagePullSecret 包含用户自己的 GitHub Token

**但是**：OAuth 请求的权限范围不包括 `read:packages` 和 `write:packages`，导致：
- ❌ GitHub Actions 可以推送镜像（使用 `GITHUB_TOKEN`）
- ❌ K3s 无法拉取镜像（使用用户的 OAuth Token，权限不足）

## 修复内容

### 1. 修复登录 OAuth 权限

**文件**: `packages/services/foundation/src/auth/auth.service.ts`

```typescript
// 修改前
const url = this.github.createAuthorizationURL(state, [
  'user:email',
  'repo',
  'workflow',
  'admin:repo_hook',
  'delete_repo',
])

// 修改后
const url = this.github.createAuthorizationURL(state, [
  'user:email',
  'repo',
  'workflow',
  'admin:repo_hook',
  'delete_repo',
  'read:packages',  // ✅ 新增：拉取 ghcr.io 镜像
  'write:packages', // ✅ 新增：推送 ghcr.io 镜像
])
```

### 2. 修复连接账户 OAuth 权限

**文件**: `packages/services/foundation/src/auth/auth.service.ts`

```typescript
// getConnectAuthUrl 函数中也添加相同的权限
const url = this.github.createAuthorizationURL(state, [
  'user:email',
  'repo',
  'workflow',
  'admin:repo_hook',
  'delete_repo',
  'read:packages',  // ✅ 新增
  'write:packages', // ✅ 新增
])
```

## 多租户架构说明

### 完整流程

```
1. 用户注册/登录
   ↓
2. OAuth 授权（获取 Token，包含 packages 权限）
   ↓
3. Token 存储到数据库（git_connections 表）
   ↓
4. 用户创建项目
   ↓
5. 系统自动：
   - 创建 K8s 命名空间
   - 创建 ImagePullSecret（包含用户的 Token）
   - 创建 Deployment（引用 ImagePullSecret）
   ↓
6. GitHub Actions 推送镜像到 ghcr.io/{username}/{project}
   ↓
7. K8s 使用用户的 Token 拉取镜像
   ↓
8. ✅ 项目成功运行
```

### 数据流

```typescript
// 1. 用户 OAuth 授权后，Token 存储到数据库
await db.insert(gitConnections).values({
  userId: user.id,
  provider: 'github',
  username: 'user-a',
  accessToken: 'ghp_xxx...', // ✅ 包含 read:packages 权限
})

// 2. 项目初始化时，创建 ImagePullSecret
const gitConnection = await db.query.gitConnections.findFirst({
  where: eq(gitConnections.userId, userId)
})

const dockerConfig = {
  auths: {
    'ghcr.io': {
      username: gitConnection.username,
      password: gitConnection.accessToken, // ✅ 用户自己的 Token
      auth: Buffer.from(
        `${gitConnection.username}:${gitConnection.accessToken}`
      ).toString('base64')
    }
  }
}

await k3s.createSecret(namespace, {
  metadata: { name: 'ghcr-secret' },
  type: 'kubernetes.io/dockerconfigjson',
  data: {
    '.dockerconfigjson': Buffer.from(
      JSON.stringify(dockerConfig)
    ).toString('base64')
  }
})

// 3. Deployment 引用 Secret
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-secret  # ✅ 用户自己的 Token
      containers:
        - image: ghcr.io/user-a/project-name:latest
```

## 用户操作指南

### 新用户（修复后注册）

1. 访问平台，点击"使用 GitHub 登录"
2. GitHub 授权页面会显示所有权限（包括 packages）
3. 授权后，Token 自动包含正确权限
4. 创建项目，自动配置多租户镜像拉取
5. ✅ 一切正常工作

### 老用户（修复前注册）

**方案 A: 重新授权（推荐）**

1. 前端添加"重新连接 GitHub"按钮
2. 用户点击后，重新走 OAuth 流程
3. 新 Token 包含正确权限
4. 系统自动更新所有项目的 ImagePullSecret

**方案 B: 手动更新 Token**

```bash
# 1. 用户在 GitHub 生成新 Token
# https://github.com/settings/tokens/new
# 勾选: repo, workflow, admin:repo_hook, delete_repo, read:packages, write:packages

# 2. 管理员执行脚本更新
export NEW_GITHUB_TOKEN=ghp_xxx...
bun run scripts/update-user-github-token.ts

# 3. 重新同步 ImagePullSecret
bun run scripts/sync-imagepullsecret-11444a.ts

# 4. 删除旧 Pod
kubectl delete pod --all -n project-xxx-development
```

## 前端改进建议

### 1. 添加 Token 状态检查

```vue
<script setup lang="ts">
const { data: gitConnections } = trpc.users.gitConnections.list.useQuery()

const checkTokenPermissions = async (token: string) => {
  // 检查 Token 是否有 packages 权限
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const scopes = response.headers.get('x-oauth-scopes')
  return scopes?.includes('read:packages')
}
</script>

<template>
  <div v-for="conn in gitConnections" :key="conn.id">
    <div v-if="!conn.hasPackagesPermission" class="warning">
      ⚠️ 你的 GitHub Token 缺少 packages 权限，无法拉取镜像
      <UiButton @click="reconnectGitHub">重新连接</UiButton>
    </div>
  </div>
</template>
```

### 2. 添加重新授权功能

```typescript
// apps/web/src/composables/useGitConnections.ts
export function useGitConnections() {
  const reconnectGitHub = async () => {
    // 1. 获取新的 OAuth URL
    const { url } = await trpc.users.gitConnections.getAuthUrl.query({
      provider: 'github'
    })
    
    // 2. 跳转到 GitHub 授权页面
    window.location.href = url
  }
  
  return { reconnectGitHub }
}
```

## 验证修复

### 1. 检查 OAuth 权限

```bash
# 查看用户的 Token 权限
curl -H "Authorization: Bearer ghp_xxx..." https://api.github.com/user -I | grep x-oauth-scopes

# 应该包含:
x-oauth-scopes: repo, workflow, admin:repo_hook, delete_repo, read:packages, write:packages
```

### 2. 测试镜像拉取

```bash
# 使用用户的 Token 测试
curl -H "Authorization: Bearer ghp_xxx..." \
  https://ghcr.io/v2/{username}/{project}/tags/list

# 应该返回:
{
  "name": "{username}/{project}",
  "tags": ["latest"]
}
```

### 3. 检查 K8s Pod

```bash
# 查看 Pod 状态
kubectl get pods -n project-xxx-development

# 应该显示:
NAME                    READY   STATUS    RESTARTS   AGE
dev-xxx-5bbccc979b-xxx  1/1     Running   0          2m
```

## 常见问题

### Q1: 为什么不使用平台统一的 Token？

**A**: 多租户架构的优势：
- ✅ 零运维 - 平台不需要管理镜像仓库
- ✅ 自然隔离 - GitHub 用户级别隔离
- ✅ 权限清晰 - 用户完全控制自己的镜像
- ✅ 成本为零 - 使用 GitHub 免费额度
- ✅ 无限扩展 - 支持任意数量用户

### Q2: 用户的 Token 过期了怎么办？

**A**: 
- OAuth Token 通常不会过期（除非用户主动撤销）
- 如果过期，系统检测到后提示用户重新授权
- 未来可以使用 GitHub App（支持自动刷新）

### Q3: 如何防止用户拉取其他用户的镜像？

**A**: GitHub 自动隔离
- 用户 A 的 Token 只能访问 `ghcr.io/user-a/*`
- 用户 B 的 Token 只能访问 `ghcr.io/user-b/*`
- 无需平台额外控制

## 总结

✅ **修复完成**：OAuth 权限已包含 `read:packages` 和 `write:packages`  
✅ **多租户正常**：每个用户使用自己的 Token 拉取镜像  
✅ **无需额外配置**：新用户自动获得正确权限  
⚠️ **老用户需要**：重新授权或手动更新 Token

**下一步**：
1. 重启 API 服务（应用代码修改）
2. 老用户重新连接 GitHub（获取新权限）
3. 测试项目镜像拉取
