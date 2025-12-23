# 模板变量未渲染导致 Flux Kustomization 失败

**日期**: 2024-12-22  
**状态**: ✅ 已解决  
**影响**: 项目初始化后 Flux 无法部署应用

## 问题描述

项目创建后，Flux Kustomization 一直处于 `reconciling` 状态，查看详细错误：

```
error converting YAML to JSON: yaml: invalid map key: 
map[interface {}]interface {}{"appName":interface {}(nil)} <nil>
```

## 根本原因

**模板文件使用了错误的语法**：

1. ❌ **模板文件使用 Handlebars 语法** `{{ }}`
2. ✅ **渲染器使用 EJS 语法** `<% %>`
3. 结果：变量没有被渲染，直接推送到 GitHub，导致 Flux 解析失败

### 错误示例

```yaml
# ❌ 错误：使用 Handlebars 语法
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ appName }}  # 未被渲染
```

### 正确示例

```yaml
# ✅ 正确：使用 EJS 语法
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <%= projectSlug %>  # 正确渲染
```

## 问题分析

### 1. 模板系统架构

项目使用 **EJS 模板引擎**（已在之前迁移中完成）：

- **分隔符**: `<% %>` （避免与 GitHub Actions 的 `${{ }}` 冲突）
- **渲染器**: `TemplateRenderer` 服务
- **变量**: 在 `project-initialization.worker.ts` 中定义

### 2. 可用的模板变量

```typescript
{
  // 项目信息
  projectId: string          // UUID
  projectName: string        // 用户输入的名称
  projectSlug: string        // 自动生成的 slug
  description: string        // 项目描述
  
  // K8s 配置
  appName: string           // = projectSlug
  registry: string          // 镜像仓库地址
  port: number              // 端口号
  domain: string            // 域名
  replicas: number          // 副本数
  
  // 平台配置
  platformApiUrl: string    // 平台 API 地址（用于 CI/CD 回调）
}
```

### 3. 两种语法的区别

| 用途 | 语法 | 何时渲染 | 示例 |
|------|------|----------|------|
| **EJS 模板变量** | `<% %>` | 项目创建时 | `<%= projectSlug %>` |
| **GitHub Actions 变量** | `${{ }}` | Workflow 运行时 | `${{ github.sha }}` |

**关键点**：
- EJS 变量在推送到 Git **之前**渲染
- GitHub Actions 变量在 Workflow **运行时**由 GitHub 提供
- 两者不冲突，可以共存

## 解决方案

### 1. 更新所有 K8s 模板文件

将所有 `{{ }}` 改为 `<%= %>`：

```bash
# 受影响的文件
templates/nextjs-15-app/k8s/base/deployment.yaml
templates/nextjs-15-app/k8s/base/service.yaml
templates/nextjs-15-app/k8s/base/ingress.yaml
templates/nextjs-15-app/k8s/overlays/*/kustomization.yaml
templates/nextjs-15-app/k8s/overlays/*/deployment-patch.yaml
```

### 2. 关键修改

**Deployment**:
```yaml
# 修改前
name: {{ appName }}

# 修改后
name: <%= projectSlug %>
```

**Kustomization**:
```yaml
# 修改前
namespace: project-{{ projectId }}-development
target:
  name: {{ appName }}

# 修改后
namespace: project-<%= projectId %>-development
target:
  name: <%= projectSlug %>
```

**Ingress**:
```yaml
# 修改前
host: {{ appName }}.{{ domain }}

# 修改后
host: <%= projectSlug %>.example.com
```

### 3. GitHub Actions Workflow

**保持 GitHub Actions 语法不变**：

```yaml
# ✅ 正确：EJS 变量（项目创建时渲染）
env:
  PROJECT_ID: "<%projectId%>"
  PLATFORM_API_URL: "<%platformApiUrl%>"

# ✅ 正确：GitHub Actions 变量（运行时提供）
steps:
  - name: Extract metadata
    run: |
      echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT
      echo "repo=${{ github.repository }}" >> $GITHUB_OUTPUT
```

## 验证方法

### 1. 运行测试脚本

```bash
bun run scripts/test-template-ejs-render.ts
```

**预期输出**：
```
✅ All tests passed!
📊 Results: 10 passed, 0 failed
```

### 2. 检查渲染后的文件

创建新项目后，检查 GitHub 仓库中的文件：

```bash
# 查看 kustomization.yaml
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/USER/REPO/contents/k8s/overlays/development/kustomization.yaml \
  | jq -r '.content' | base64 -d
```

**应该看到**：
```yaml
namespace: project-760df6dc-8f7f-48ad-8561-8a71d07b8155-development
target:
  name: project-1766407599763-6f6jg9
```

**不应该看到**：
```yaml
namespace: project-{{ projectId }}-development  # ❌ 错误
target:
  name: {{ appName }}  # ❌ 错误
```

### 3. 检查 Flux 状态

```bash
kubectl get kustomizations -n project-XXX-development
```

**预期状态**：
```
NAME                    READY   STATUS
XXX-development         True    Applied revision: main@sha1:...
```

## 相关文档

- [模板系统 EJS 迁移](../architecture/template-system-ejs-migration.md)
- [Handlebars 与 GitHub Actions 冲突](./template-system-handlebars-github-actions-conflict.md)
- [Handlebars 清理完成](./handlebars-cleanup-complete.md)

## 经验教训

1. **模板引擎迁移要彻底**
   - 不仅要更新渲染器代码
   - 还要更新所有模板文件的语法

2. **区分两种变量**
   - EJS 变量：项目创建时渲染
   - GitHub Actions 变量：运行时提供
   - 不要混淆

3. **测试驱动开发**
   - 创建测试脚本验证模板渲染
   - 在推送到生产前验证所有文件

4. **文档同步更新**
   - 模板变量文档
   - 示例代码
   - 故障排查指南
