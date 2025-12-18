# K8s 模板设计方案

## 问题

模板文件包含 Handlebars 变量（`{{ appName }}`），但推送到 Git 后 Flux 无法渲染这些变量。

## 现代化方案：Kustomize 变量替换

### 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| 固定名称 `app` | 简单 | ❌ 不灵活，无法区分项目 |
| Handlebars 渲染后推送 | 灵活 | ✅ 需要在推送前渲染 |
| Kustomize vars | 标准 | 需要配置 |

### 推荐方案：推送前渲染模板

**流程**:
```
1. Worker 渲染模板（Handlebars）
   ├─ 注入变量：appName, registry, port, domain
   ├─ 渲染所有文件（包括 k8s/*.yaml）
   └─ 得到完整的文件列表

2. 推送到 Git
   ├─ 所有模板变量已被替换
   └─ Flux 可以直接使用

3. Flux 读取并应用
   ├─ GitRepository 拉取代码
   └─ Kustomization 应用配置
```

**优点**:
- ✅ 灵活：每个项目有独立的资源名称
- ✅ 标准：使用 Handlebars 模板
- ✅ 简单：Flux 直接读取，无需额外配置
- ✅ 可追溯：Git 中是最终配置

**实现**:
```typescript
// Worker 中
const files = await this.templateRenderer.renderTemplateToMemory(
  'nextjs-15-app',
  {
    appName: project.slug,
    registry: 'registry.example.com',
    port: 3000,
    domain: 'example.com',
    replicas: 1,
  }
)

// files 包含所有渲染后的文件，包括 k8s/*.yaml
await this.gitProvider.pushFiles(...)
```

## 模板设计

### base/deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ appName }}
  labels:
    app: {{ appName }}
spec:
  replicas: {{ replicas }}
  selector:
    matchLabels:
      app: {{ appName }}
  template:
    metadata:
      labels:
        app: {{ appName }}
    spec:
      containers:
      - name: {{ appName }}
        image: {{ registry }}/{{ appName }}:latest
        ports:
        - containerPort: {{ port }}
```

### overlays/development/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namePrefix: dev-
```

### 渲染后（推送到 Git）

**base/deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-project
  labels:
    app: my-project
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-project
  template:
    metadata:
      labels:
        app: my-project
    spec:
      containers:
      - name: my-project
        image: registry.example.com/my-project:latest
        ports:
        - containerPort: 3000
```

## 当前实现状态

✅ **已实现**: `renderTemplateToMemory` 会渲染所有文件
✅ **已实现**: 推送到 Git 的是渲染后的文件
❌ **问题**: 模板文件设计不合理（太复杂）

## 修复步骤

1. 恢复模板文件中的 Handlebars 变量
2. 简化模板（删除过度复杂的配置）
3. 确保 renderTemplateToMemory 正确渲染 k8s 文件
4. 测试完整流程
