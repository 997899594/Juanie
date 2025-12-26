# GitHub Actions 部署触发失败修复

## 问题描述

**日期**: 2024-12-23  
**症状**: GitHub Actions workflow 在 "Trigger deployment" 步骤失败，退出码 3

**错误日志**:
```
Run echo "🚀 Triggering deployment to development environment..."
🚀 Triggering deployment to development environment...
Error: Process completed with exit code 3.
```

**详细分析**:
```yaml
env:
  REGISTRY: ghcr.io
  PROJECT_ID:           # ❌ 空值
  PLATFORM_API_URL:     # ❌ 空值
```

```bash
curl -s -w "\n%{http_code}" -X POST \
  "/api/trpc/deployments.triggerDeploy" \  # ❌ 相对路径，缺少 host
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "",  # ❌ 空值
    ...
  }'
```

---

## 根本原因

1. **模板变量未渲染**
   - `PROJECT_ID` 和 `PLATFORM_API_URL` 在 workflow 中定义为 `<%projectId%>` 和 `<%platformApiUrl%>`
   - 项目初始化时这些变量没有被正确传递给模板渲染器
   - 导致环境变量为空字符串

2. **curl 命令失败**
   - `PLATFORM_API_URL` 为空，导致 curl 请求相对路径 `/api/trpc/...`
   - 没有指定服务器地址，curl 返回退出码 3（URL 格式错误）

3. **没有错误处理**
   - 原始 workflow 没有 `continue-on-error: true`
   - curl 失败后整个 job 失败

---

## 解决方案

### 方案 1：简化 workflow（推荐）

**原理**: 开发环境不需要 API 回调，Flux CD 会自动从 Git 同步部署。

**修改**: 移除或简化 "Trigger deployment" 步骤

```yaml
- name: Deployment info
  run: |
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "**Deployment:**" >> $GITHUB_STEP_SUMMARY
    echo "- 🔄 Flux CD will auto-deploy from Git" >> $GITHUB_STEP_SUMMARY
    echo "- 📦 Image: \`${{ env.REGISTRY }}/${{ github.repository_owner }}/${{ steps.meta.outputs.project_slug }}:${{ steps.meta.outputs.tag }}\`" >> $GITHUB_STEP_SUMMARY
```

**优点**:
- ✅ 简单可靠
- ✅ 不依赖平台 API
- ✅ Flux 自动同步（默认 1 分钟）

---

### 方案 2：添加错误处理（生产环境）

**原理**: 保留 API 回调功能，但添加完善的错误处理。

**修改**: 已在模板中修复（`templates/nextjs-15-app/.github/workflows/build-project-image.yml`）

```yaml
- name: Trigger deployment
  continue-on-error: true  # ✅ 允许失败
  run: |
    echo "🚀 Triggering deployment to development environment..."
    
    # ✅ 检查环境变量
    if [ -z "${{ env.PLATFORM_API_URL }}" ] || [ "${{ env.PLATFORM_API_URL }}" = "<%platformApiUrl%>" ]; then
      echo "⚠️  PLATFORM_API_URL not configured, skipping API trigger"
      echo "- 🔄 Flux CD will auto-deploy from Git" >> $GITHUB_STEP_SUMMARY
      exit 0
    fi
    
    # ✅ 添加 || true 防止 curl 失败
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
      "${{ env.PLATFORM_API_URL }}/api/trpc/deployments.triggerDeploy" \
      ... || true)
    
    # 检查 HTTP 状态码
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
      echo "✅ Deployment triggered successfully!"
    else
      echo "⚠️  API trigger failed, but Flux will auto-deploy"
    fi
```

**优点**:
- ✅ 支持 API 回调（可选）
- ✅ 失败时优雅降级
- ✅ Flux 作为备用方案

---

### 方案 3：修复模板变量传递

**原理**: 确保 `PROJECT_ID` 和 `PLATFORM_API_URL` 在项目初始化时正确传递。

**修改**: 已在 `.env` 中添加配置

```bash
# .env
PLATFORM_API_URL=http://localhost:3000
```

**修改**: 确保 `project-initialization.worker.ts` 传递变量

```typescript
// packages/services/business/src/queue/project-initialization.worker.ts
const templateVariables = {
  projectId: project.id,
  projectSlug: project.slug,
  githubUsername: githubUsername || 'unknown',
  registry: 'ghcr.io',
  platformApiUrl: this.config.get('PLATFORM_API_URL') || 'http://localhost:3000', // ✅
  // ...
}
```

**优点**:
- ✅ 完整功能
- ✅ 支持 API 回调
- ✅ 适合生产环境

---

## 当前项目的快速修复

**对于已创建的项目**（如 `201`），直接编辑 GitHub 仓库中的 workflow 文件：

1. 访问 `https://github.com/997899594/201/blob/main/.github/workflows/build-project-image.yml`
2. 点击编辑按钮
3. 找到 "Trigger deployment" 步骤
4. 替换为：

```yaml
- name: Deployment info
  run: |
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "**Deployment:**" >> $GITHUB_STEP_SUMMARY
    echo "- 🔄 Flux CD will auto-deploy from Git" >> $GITHUB_STEP_SUMMARY
    echo "- 📦 Image: \`${{ env.REGISTRY }}/${{ github.repository_owner }}/${{ steps.meta.outputs.project_slug }}:${{ steps.meta.outputs.tag }}\`" >> $GITHUB_STEP_SUMMARY
```

5. 提交更改
6. 重新触发 workflow

---

## 验证

修复后，GitHub Actions 应该：
1. ✅ 成功构建镜像
2. ✅ 推送到 GHCR
3. ✅ 显示部署信息（不调用 API）
4. ✅ Flux CD 自动检测到新镜像并部署

---

## 长期方案

### 新项目

新创建的项目会使用修复后的模板，包含：
- ✅ `continue-on-error: true`
- ✅ 环境变量检查
- ✅ 优雅降级

### 生产环境

如果需要 API 回调功能：
1. 配置 `PLATFORM_API_URL` 为公网可访问的地址
2. 确保 API 端点正常工作
3. 添加认证机制（GitHub Actions secrets）

---

## 相关文件

- `templates/nextjs-15-app/.github/workflows/build-project-image.yml` - 模板 workflow
- `packages/services/business/src/queue/project-initialization.worker.ts` - 模板变量传递
- `.env` - 平台配置
- `docs/troubleshooting/multi-tenant-complete-fix-summary.md` - 多租户修复

---

## 总结

**问题**: 模板变量未渲染 + 缺少错误处理  
**影响**: GitHub Actions 构建失败  
**修复**: 简化 workflow 或添加错误处理  
**结果**: ✅ 构建成功，Flux 自动部署

**核心原则**: 
- 开发环境优先简单可靠
- 生产环境添加完善的错误处理
- Flux CD 作为主要部署方式，API 回调是可选的增强功能
