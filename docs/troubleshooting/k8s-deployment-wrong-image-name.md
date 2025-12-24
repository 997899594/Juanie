# K8s Deployment 使用错误的镜像名称

## 问题描述

所有项目的 Pod 都处于 `ImagePullBackOff` 状态，检查发现镜像名称错误：

```bash
# 实际镜像
ghcr.io/unknown/project-1766468376851-seag2q:latest

# 期望镜像
ghcr.io/997899594/my-project-slug:latest
```

**两个问题**：
1. 使用了 `unknown` 而不是 GitHub 用户名
2. 使用了 `project-{timestamp}-{random}` 而不是 `projectSlug`

## 根本原因

**双重错误处理导致渲染失败被静默忽略**：

### 问题代码

```typescript
// readAndRenderFile 方法
try {
  const rendered = await this.renderContent(content, variables, sourcePath)
  return rendered
} catch (error) {
  // ❌ 捕获了 renderContent 抛出的错误
  // 返回原始内容，导致变量未替换
  const content = await fs.readFile(sourcePath, 'utf-8')
  return content
}
```

### 执行流程

1. `renderContent` 检测到关键文件（.yaml）渲染失败
2. `renderContent` 抛出错误（正确行为）
3. `readAndRenderFile` 的 catch 块捕获错误
4. 返回原始内容（包含未替换的 EJS 变量）
5. 推送到 Git 仓库
6. Flux 同步错误的配置到 K8s
7. Pod 尝试拉取不存在的镜像

## 影响范围

**所有项目**都受影响，因为：
- Git 仓库中的 K8s 配置文件包含未渲染的变量
- Flux 已经成功同步（状态为 Ready）
- 但 Pod 无法启动（镜像不存在）

## 修复方案

### 1. 修复代码（已完成）

移除 `readAndRenderFile` 和 `copyAndRenderFile` 中的 try-catch 块，让 `renderContent` 的错误直接抛出：

```typescript
// ✅ 修复后
private async readAndRenderFile(
  sourcePath: string,
  variables: TemplateVariables,
): Promise<string> {
  const ext = path.extname(sourcePath).toLowerCase()

  if (this.isBinaryFile(ext)) {
    const buffer = await fs.readFile(sourcePath)
    return buffer.toString('base64')
  }

  // 读取文件内容
  const content = await fs.readFile(sourcePath, 'utf-8')

  // 渲染模板（renderContent 内部已处理关键文件的错误）
  const rendered = await this.renderContent(content, variables, sourcePath)

  return rendered
}
```

### 2. 修复现有项目

对于已创建的项目，需要手动修复 Git 仓库中的 K8s 配置：

#### 方案 A：重新推送模板（推荐）

1. 删除项目
2. 使用修复后的代码重新创建项目

#### 方案 B：手动修复 Git 仓库

编辑 `k8s/base/deployment.yaml`：

```yaml
# 修改前
spec:
  containers:
  - name: <%= projectSlug %>
    image: ghcr.io/<%= githubUsername %>/<%= projectSlug %>:latest

# 修改后（替换为实际值）
spec:
  containers:
  - name: my-project
    image: ghcr.io/997899594/my-project:latest
```

同时修复所有环境的 patch 文件：
- `k8s/overlays/development/deployment-patch.yaml`
- `k8s/overlays/staging/deployment-patch.yaml`
- `k8s/overlays/production/deployment-patch.yaml`

提交并推送后，Flux 会自动同步。

## 验证修复

### 1. 检查新项目

创建新项目后，检查 Git 仓库中的文件：

```bash
# 克隆项目仓库
git clone https://github.com/username/project-repo.git
cd project-repo

# 检查 deployment.yaml
cat k8s/base/deployment.yaml | grep "image:"
```

应该看到：
```yaml
image: ghcr.io/997899594/my-project:latest
```

而不是：
```yaml
image: ghcr.io/<%= githubUsername %>/<%= projectSlug %>:latest
```

### 2. 检查 Pod 状态

```bash
kubectl get pods -n project-xxx-development
```

应该看到 Pod 状态为 `Running` 或 `ContainerCreating`，而不是 `ImagePullBackOff`。

## 技术细节

### 为什么需要两层错误处理？

**不需要！** 这是设计错误。

正确的设计：
- `renderContent` 负责渲染和错误处理
- `readAndRenderFile` 只负责文件 I/O
- 关键文件渲染失败时，错误应该直接抛出到调用方

### EJS 渲染失败的常见原因

1. **变量未定义**：
   ```typescript
   // 模板中使用了 <%= githubUsername %>
   // 但 variables 中没有 githubUsername
   ```

2. **语法错误**：
   ```yaml
   # ❌ 错误
   PROJECT_SLUG: "<%projectSlug%>"
   
   # ✅ 正确
   PROJECT_SLUG: "<%= projectSlug %>"
   ```

3. **类型错误**：
   ```typescript
   // 模板中使用了 <%= project.name.toUpperCase() %>
   // 但 project.name 是 undefined
   ```

### 为什么 Flux 显示 Ready？

Flux 只检查：
1. Git 仓库是否可访问
2. YAML 文件是否语法正确
3. K8s 资源是否成功创建

Flux **不检查**：
- 镜像是否存在
- Pod 是否能启动
- 应用是否健康

所以即使配置错误，Flux 也会显示 Ready。

## 预防措施

### 1. 添加模板渲染验证

```typescript
// 在推送到 Git 之前验证
const files = await this.templateRenderer.renderTemplateToMemory(
  'nextjs-15-app',
  templateVariables,
)

// 检查关键文件是否包含未替换的变量
for (const file of files) {
  if (file.path.endsWith('.yaml') || file.path.endsWith('.yml')) {
    if (file.content.includes('<%') && file.content.includes('%>')) {
      throw new Error(`Template variables not replaced in ${file.path}`)
    }
  }
}
```

### 2. 添加集成测试

```typescript
describe('Template Rendering', () => {
  it('should replace all variables in K8s manifests', async () => {
    const files = await templateRenderer.renderTemplateToMemory('nextjs-15-app', {
      projectSlug: 'test-project',
      githubUsername: 'testuser',
      // ...
    })

    const deployment = files.find(f => f.path.includes('deployment.yaml'))
    expect(deployment.content).toContain('ghcr.io/testuser/test-project')
    expect(deployment.content).not.toContain('<%')
  })
})
```

### 3. 监控 Pod 状态

在项目初始化完成后，检查 Pod 状态：

```typescript
// 等待 30 秒后检查
await new Promise(resolve => setTimeout(resolve, 30000))

const pods = await k3s.getPods(namespace)
const failedPods = pods.filter(p => p.status === 'ImagePullBackOff')

if (failedPods.length > 0) {
  throw new Error(`Deployment failed: ${failedPods.length} pods in ImagePullBackOff`)
}
```

## 相关文档

- [Workflow PROJECT_SLUG 缺失](./workflow-project-slug-missing.md)
- [EJS 模板系统迁移](../architecture/template-system-ejs-migration.md)
- [项目初始化流程](../architecture/project-initialization-flow-analysis.md)

## 更新日志

- **2025-12-23**: 发现并修复双重错误处理问题
- **2025-12-23**: 添加本文档
