# projectSlug 彻底移除完成

**日期**: 2025-01-22  
**状态**: ✅ 已完成  
**影响范围**: 后端、模板、类型定义

## 问题背景

所有 Pod 都处于 `ImagePullBackOff` 状态，镜像名称错误：
```
ghcr.io/unknown/project-1766468376851-seag2q:latest
```

**根本原因**:
1. 使用了 `projectSlug` 而不是 `projectName`
2. 多个地方存在旧代码使用 `project.slug`
3. 双重错误处理导致模板渲染失败被静默忽略

## 修复内容

### 1. 删除模板中的 projectSlug

**修改的文件**:
- `templates/nextjs-15-app/.github/workflows/build-project-image.yml`
  - 使用 `PROJECT_NAME` 环境变量
  - 镜像名称: `ghcr.io/${{ env.GITHUB_USERNAME }}/${{ env.PROJECT_NAME }}:${{ github.sha }}`

- 所有 K8s YAML 文件:
  - `k8s/base/deployment.yaml`
  - `k8s/base/service.yaml`
  - `k8s/base/ingress.yaml`
  - `k8s/base/kustomization.yaml`
  - `k8s/overlays/*/deployment-patch.yaml`
  - `k8s/overlays/*/kustomization.yaml`
  - 全部使用 `<%= projectName %>` 替换 `<%= projectSlug %>`

- `README.md`
  - 使用 `<%= projectName %>`

### 2. 修改后端代码

**修改的文件**:
- `packages/services/business/src/queue/project-initialization.worker.ts`
  - 传递 `projectName` 而不是 `projectSlug`
  - 模板变量中使用 `projectName`

- `packages/services/business/src/projects/template-renderer.service.ts`
  - 删除 `TemplateVariables.projectSlug`
  - 移除双重错误处理（让错误正常抛出）

- `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`
  - 修复 3 处使用 `project.slug` 的地方
  - 改为从 `repositories` 表查询 `fullName`

### 3. 修改类型定义

**修改的文件**:
- `packages/types/src/template.types.ts`
  - 删除 `projectSlug` 字段

- `packages/types/src/schemas.ts`
  - 删除 `projectSlug` 验证

## 验证结果

### 构建验证
```bash
✅ bun run build --filter=@juanie/service-business --filter=@juanie/api-gateway
Tasks:    6 successful, 6 total
Cached:    3 cached, 6 total
Time:    4.846s
```

### 代码搜索验证
```bash
✅ grep -r "projectSlug" packages/services/business/  # 无结果
✅ grep -r "projectSlug" templates/                   # 无结果
✅ grep -r "projectSlug" packages/types/              # 无结果
```

## 预期效果

创建新项目后：

1. **模板渲染正确**
   - GitHub Actions workflow 使用正确的项目名称
   - K8s 配置使用正确的项目名称

2. **镜像名称正确**
   ```
   ghcr.io/<github-username>/<project-name>:latest
   ```

3. **Pod 正常启动**
   - 镜像拉取成功
   - 部署状态正常

## 测试步骤

1. 创建新项目
2. 检查 Git 仓库中的文件：
   - `.github/workflows/build-project-image.yml` - 确认使用 `PROJECT_NAME`
   - `k8s/base/deployment.yaml` - 确认镜像名称正确
3. 等待 GitHub Actions 构建完成
4. 检查 Pod 状态：
   ```bash
   kubectl get pods -n project-<project-id>-development
   ```

## 相关文档

- [K8s 部署镜像名称错误](./k8s-deployment-wrong-image-name.md)
- [Workflow projectSlug 缺失](./workflow-project-slug-missing.md)
- [模板系统 EJS 迁移](../architecture/template-system-ejs-migration.md)

## 经验教训

1. **不要保留多个路径** - 每次修改都要彻底删除旧代码
2. **不要隐藏错误** - 移除双重错误处理，让错误快速失败
3. **使用正确的数据源** - 从 `repositories` 表查询而不是拼接字符串
4. **验证完整性** - 使用 grep 搜索确保所有旧代码都已删除
