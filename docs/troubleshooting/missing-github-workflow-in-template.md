# 模板缺少 GitHub Actions Workflow

## 问题

创建项目 012 后发现：
- GitOps 资源创建成功
- 但镜像不存在，Pod 无法启动
- 检查发现仓库中没有 `.github/workflows/build-project-image.yml`

## 原因

模板 `templates/nextjs-15-app/` 中缺少 GitHub Actions workflow 文件。

## 解决方案

### 1. 添加 Workflow 到模板

已添加 `templates/nextjs-15-app/.github/workflows/build-project-image.yml`

**关键配置**:
```yaml
env:
  REGISTRY: {{ registry }}           # 使用模板变量
  PROJECT_SLUG: {{ projectSlug }}    # 使用模板变量

on:
  push:
    branches:
      - main
      - master
    paths-ignore:
      - '**.md'
      - 'docs/**'
      # 不要忽略 .github/**，否则首次推送不会触发
  workflow_dispatch:
```

### 2. 模板变量

在 `project-initialization.worker.ts` 中传递：
```typescript
const templateVariables = {
  projectSlug: project.slug,
  registry: this.config.get('REGISTRY_URL') || 'ghcr.io',
  // ...
}
```

### 3. 验证

创建新项目后检查：
```bash
# 1. 检查仓库是否有 workflow 文件
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/contents/.github/workflows"

# 2. 检查 workflow 是否被触发
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/actions/runs"

# 3. 检查镜像是否存在
docker pull ghcr.io/OWNER/PROJECT_SLUG:latest
```

## 测试计划

1. **重新创建项目 013**
   - 使用更新后的模板
   - 观察是否自动触发构建

2. **检查点**
   - ✅ 仓库包含 workflow 文件
   - ✅ Push 代码后自动触发
   - ✅ 镜像构建成功
   - ✅ Pod 正常启动

## 临时解决方案（针对 012）

手动添加 workflow 文件并触发构建：

1. 在 GitHub 网站手动创建 `.github/workflows/build-project-image.yml`
2. 手动触发 workflow
3. 等待镜像构建完成
4. Flux 会自动检测并部署

## 相关文件

- `templates/nextjs-15-app/.github/workflows/build-project-image.yml` - Workflow 模板
- `packages/services/business/src/queue/project-initialization.worker.ts` - 项目初始化
- `packages/services/business/src/projects/template-renderer.service.ts` - 模板渲染

## 状态

- [x] 添加 workflow 到模板
- [ ] 测试新项目创建
- [ ] 验证自动触发
- [ ] 修复 012 项目
