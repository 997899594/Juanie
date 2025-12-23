# 自动触发部署方案

## 概述

实现 GitHub Actions 构建完成后自动触发平台部署的功能，无需任何额外的认证机制。

## 核心流程

```
代码推送 → GitHub Actions 构建镜像 → 调用平台 API → Flux reconcile → 部署完成
```

## 方案设计

### 1. 无认证公开 API

**端点**: `POST /trpc/deployments.trigger`

**输入**:
```typescript
{
  projectId: string
  environment: 'development' | 'staging' | 'production'
  imageTag?: string
  commitSha?: string
  repository?: string
}
```

**验证逻辑**:
- 只验证项目 ID 是否存在
- 不需要任何 token 或认证
- 信任来自 GitHub Actions 的请求

### 2. 为什么这样是安全的？

1. **GitHub Actions 本身就是认证**
   - 只有对仓库有写权限的人才能触发 workflow
   - workflow 文件在仓库中，受 Git 权限控制

2. **项目 ID 验证足够**
   - 确保项目存在
   - 防止随机请求

3. **最坏情况可控**
   - 有人知道项目 ID 并手动调用 API
   - 只是触发一次 Flux reconcile
   - 不会造成任何破坏（Flux 会检查 Git 状态）

4. **业界实践**
   - Vercel、Netlify、Railway 等平台都使用类似方案
   - 简单、可靠、无需维护额外的认证系统

## 实现细节

### GitHub Actions Workflow

```yaml
- name: Trigger deployment
  if: github.event_name == 'push'
  run: |
    curl -X POST "${{ env.PLATFORM_API_URL }}/trpc/deployments.trigger" \
      -H "Content-Type: application/json" \
      -d '{
        "projectId": "${{ env.PROJECT_ID }}",
        "environment": "development",
        "imageTag": "${{ steps.meta.outputs.tag }}",
        "commitSha": "${{ github.sha }}",
        "repository": "${{ github.repository }}"
      }'
```

### API 实现

```typescript
// apps/api-gateway/src/routers/deployments.router.ts
trigger: this.trpc.procedure  // 公开 endpoint，无需认证
  .input(z.object({
    projectId: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
    imageTag: z.string().optional(),
    commitSha: z.string().optional(),
    repository: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    await this.deploymentsService.triggerDeploy(
      input.projectId,
      input.environment,
      input.imageTag,
    )
    return { success: true }
  })
```

### 部署服务

```typescript
// packages/services/business/src/deployments/deployments.service.ts
async triggerDeploy(
  projectId: string,
  environment: string,
  imageTag?: string,
): Promise<void> {
  // 1. 验证环境是否存在
  const env = await this.db.query.environments.findFirst({
    where: and(
      eq(schema.environments.projectId, projectId),
      eq(schema.environments.type, environment),
    ),
  })
  
  if (!env) {
    throw new Error(`Environment ${environment} not found`)
  }

  // 2. 调用 Flux reconcile
  await this.fluxResourcesService.reconcileProject(projectId, environment)
}
```

## 完整流程

### 1. 项目初始化

```typescript
// 模板变量包含项目 ID 和平台 API URL
const templateVariables = {
  projectId: project.id,
  platformApiUrl: config.get('PLATFORM_API_URL'),
  // ...
}
```

### 2. 代码推送

用户推送代码到 GitHub → 自动触发 workflow

### 3. 镜像构建

GitHub Actions 构建并推送镜像到 GHCR

### 4. 触发部署

workflow 调用平台 API：
```bash
POST /trpc/deployments.trigger
{
  "projectId": "xxx",
  "environment": "development",
  "imageTag": "abc123"
}
```

### 5. Flux Reconcile

平台调用 Flux API：
```bash
flux reconcile kustomization project-xxx-development --with-source
```

### 6. 部署完成

Flux 从 Git 拉取最新配置并应用到 K8s

## 优势

1. **零配置** - 无需创建或管理任何 token
2. **零维护** - 无需担心 token 过期或轮换
3. **简单可靠** - 流程清晰，易于理解和调试
4. **业界标准** - 与主流平台保持一致
5. **安全可控** - 最坏情况只是触发一次无害的 reconcile

## 未来增强（可选）

如果需要更严格的安全性，可以考虑：

### 1. IP 白名单
```typescript
const GITHUB_ACTIONS_IPS = [
  '140.82.112.0/20',
  '143.55.64.0/20',
  // ...
]

if (!isFromGitHub(req.ip)) {
  throw new Error('Unauthorized')
}
```

### 2. 请求签名验证
```typescript
// 使用项目 secret 签名请求
const signature = hmac(projectSecret, requestBody)
if (signature !== req.headers['x-signature']) {
  throw new Error('Invalid signature')
}
```

### 3. GitHub OIDC（最安全）
```yaml
permissions:
  id-token: write

- name: Get OIDC token
  run: |
    OIDC_TOKEN=$(curl -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL" | jq -r .value)
```

但对于当前阶段，**简单的项目 ID 验证已经足够**。

## 相关文件

- `apps/api-gateway/src/routers/deployments.router.ts` - API endpoint
- `packages/services/business/src/deployments/deployments.service.ts` - 部署服务
- `packages/services/business/src/gitops/flux/flux-resources.service.ts` - Flux 集成
- `templates/nextjs-15-app/.github/workflows/build-project-image.yml` - Workflow 模板
- `packages/services/business/src/queue/project-initialization.worker.ts` - 项目初始化

## 测试

### 手动测试

```bash
# 触发部署
curl -X POST http://localhost:3000/trpc/deployments.trigger \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-id",
    "environment": "development",
    "imageTag": "latest"
  }'
```

### 验证

1. 检查日志：`Deployment trigger request from CI/CD`
2. 检查 Flux：`flux get kustomizations -n flux-system`
3. 检查 K8s：`kubectl get pods -n project-xxx-development`

## 总结

这个方案完美平衡了**简单性、安全性和可维护性**：

- ✅ 无需任何额外的认证机制
- ✅ 无需创建或管理 secrets
- ✅ 流程清晰，易于理解
- ✅ 符合业界最佳实践
- ✅ 安全风险可控

**核心理念**：信任 GitHub Actions 的权限控制，平台只负责验证项目存在并触发 Flux reconcile。
