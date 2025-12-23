# 现代化 CI/CD 流程

## 问题

手动触发 GitHub Actions 构建镜像太 low，不符合现代化 DevOps 实践。

## 现代化方案

### 自动触发 CI/CD

**触发条件**:
- ✅ Push 到 main/master 分支 → 自动构建
- ✅ 代码变更（排除文档） → 自动构建
- ✅ 手动触发（可选） → 兼容性

### 工作流程

```
开发者 Push 代码
    ↓
GitHub Actions 自动触发
    ↓
构建 Docker 镜像
    ↓
推送到 ghcr.io
    ↓
Flux CD 自动检测
    ↓
更新 K8s 部署
    ↓
完成 ✅
```

## 实现方案

### 1. 自动触发构建

**配置**: `.github/workflows/build-project-image.yml`

```yaml
on:
  push:
    branches:
      - main
      - master
    paths-ignore:
      - '**.md'          # 忽略文档变更
      - 'docs/**'        # 忽略文档目录
      - '.github/**'     # 忽略 workflow 变更
  workflow_dispatch:     # 保留手动触发（可选）
```

**效果**:
- Push 代码 → 自动构建
- 修改文档 → 不触发构建
- 需要时 → 可手动触发

### 2. 智能标签管理

**自动标签**:
```yaml
tags: |
  ghcr.io/997899594/011:${{ github.sha }}    # Git commit SHA
  ghcr.io/997899594/011:latest               # 最新版本
```

**优势**:
- 每次构建都有唯一标识（SHA）
- 始终更新 latest 标签
- 可回滚到任意版本

### 3. Flux CD 自动部署

**ImagePolicy 配置**:

```yaml
# templates/nextjs-15-app/k8s/base/imagepolicy.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: {{ appName }}
spec:
  image: {{ registry }}/{{ appName }}
  interval: 1m
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: {{ appName }}
spec:
  imageRepositoryRef:
    name: {{ appName }}
  policy:
    semver:
      range: '*'
  filterTags:
    pattern: '^[a-f0-9]{40}$'  # 匹配 Git SHA
---
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: {{ appName }}
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: {{ appName }}-repo
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@users.noreply.github.com
        name: fluxcdbot
      messageTemplate: |
        Update image to {{range .Updated.Images}}{{println .}}{{end}}
  update:
    path: ./k8s/overlays/production
    strategy: Setters
```

**工作流程**:
1. Flux 每分钟检查镜像仓库
2. 发现新镜像 → 自动更新 K8s 配置
3. 提交变更到 Git
4. 触发 Kustomization 更新
5. 部署新版本

### 4. 完整的自动化流程

```
开发者 Push 代码
    ↓
GitHub Actions 自动构建
    ↓ (2-5 分钟)
镜像推送到 ghcr.io
    ↓
Flux ImageRepository 检测新镜像
    ↓ (1 分钟)
Flux ImageUpdateAutomation 更新配置
    ↓
提交到 Git 仓库
    ↓
Flux Kustomization 检测变更
    ↓ (5 分钟)
K8s 滚动更新
    ↓
完成 ✅
```

**总耗时**: 约 8-11 分钟（全自动）

## 对比

### 手动方案（Low）

```
开发者 Push 代码
    ↓
手动打开 GitHub Actions
    ↓
手动点击 "Run workflow"
    ↓
手动输入参数
    ↓
等待构建完成
    ↓
手动触发部署（或等待 Flux）
    ↓
完成
```

**问题**:
- ❌ 需要人工介入
- ❌ 容易遗忘
- ❌ 效率低下
- ❌ 不符合 DevOps 理念

### 自动方案（Modern）

```
开发者 Push 代码
    ↓
（全自动）
    ↓
完成 ✅
```

**优势**:
- ✅ 零人工介入
- ✅ 快速反馈
- ✅ 持续部署
- ✅ 符合 DevOps 最佳实践

## 高级特性

### 1. 多环境部署策略

**Development**: 自动部署（每次 Push）
```yaml
# k8s/overlays/development/imagepolicy.yaml
spec:
  policy:
    semver:
      range: '*'  # 任何版本
```

**Staging**: 自动部署（每次 Push）
```yaml
# k8s/overlays/staging/imagepolicy.yaml
spec:
  policy:
    semver:
      range: '*'  # 任何版本
```

**Production**: 手动审批（使用 Git Tag）
```yaml
# k8s/overlays/production/imagepolicy.yaml
spec:
  policy:
    semver:
      range: '>=1.0.0'  # 只部署正式版本
```

### 2. 金丝雀发布

```yaml
# k8s/overlays/production/rollout.yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: {{ appName }}
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ appName }}
  progressDeadlineSeconds: 60
  service:
    port: {{ port }}
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
```

**流程**:
1. 新版本部署到 10% 流量
2. 监控成功率
3. 成功 → 增加到 20%
4. 重复直到 100%
5. 失败 → 自动回滚

### 3. 自动回滚

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: {{ appName }}-production
spec:
  interval: 5m
  path: ./k8s/overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: {{ appName }}-repo
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: {{ appName }}
    namespace: {{ namespace }}
  timeout: 5m
  # 自动回滚
  retryInterval: 1m
  force: false
```

**触发条件**:
- Pod 启动失败
- 健康检查失败
- 超时未就绪

### 4. 通知集成

**Slack 通知**:
```yaml
# k8s/base/alert.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta1
kind: Alert
metadata:
  name: {{ appName }}
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
  - kind: Kustomization
    name: {{ appName }}-*
  - kind: ImageUpdateAutomation
    name: {{ appName }}
```

**通知内容**:
- ✅ 新镜像构建完成
- ✅ 部署开始
- ✅ 部署成功
- ❌ 部署失败
- ⚠️  自动回滚

## 实施步骤

### 阶段 1: 自动构建（已完成 ✅）

- ✅ 更新 GitHub Actions workflow
- ✅ 配置自动触发
- ✅ 智能标签管理

### 阶段 2: 自动部署（下一步）

1. **添加 Flux Image Automation**:
```bash
flux install --components=image-reflector-controller,image-automation-controller
```

2. **创建 ImagePolicy 模板**:
```bash
# 添加到项目模板
templates/nextjs-15-app/k8s/base/imagepolicy.yaml
```

3. **更新项目初始化流程**:
```typescript
// 在 setupProjectGitOps 中创建 ImagePolicy
await this.createImagePolicy({
  name: `${projectId}-${environment.type}`,
  namespace,
  imageRepository: `${registry}/${projectSlug}`,
  policy: environment.type === 'production' ? 'semver' : 'latest',
})
```

### 阶段 3: 高级特性（可选）

- [ ] 金丝雀发布（Flagger）
- [ ] 自动回滚
- [ ] Slack 通知
- [ ] 性能监控

## 最佳实践

### 1. 语义化版本

使用 Git Tag 标记版本：
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

GitHub Actions 自动识别：
```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

### 2. 分支策略

- `main` → Development 自动部署
- `staging` → Staging 自动部署
- `v*.*.*` Tag → Production 自动部署

### 3. 环境隔离

- Development: 最新代码，快速迭代
- Staging: 稳定版本，测试验证
- Production: 正式版本，手动审批

### 4. 监控告警

- 构建失败 → Slack 通知
- 部署失败 → 自动回滚 + 告警
- 性能下降 → 自动回滚

## 总结

### 优化前（手动）

```
Push 代码 → 手动触发构建 → 等待 → 手动部署
耗时: 10-20 分钟（含人工操作）
```

### 优化后（自动）

```
Push 代码 → 自动构建 → 自动部署 → 完成
耗时: 8-11 分钟（全自动）
```

### 关键改进

- ✅ **零人工介入**: Push 即部署
- ✅ **快速反馈**: 8-11 分钟完成
- ✅ **持续部署**: 符合 DevOps 理念
- ✅ **自动回滚**: 失败自动恢复
- ✅ **通知集成**: 实时状态更新

### 下一步

1. ✅ 自动构建已完成
2. ⏳ 配置 Flux Image Automation
3. ⏳ 添加 ImagePolicy 模板
4. ⏳ 更新项目初始化流程
5. ⏳ 测试完整流程

**现在的方案**: Push 代码 → 自动构建镜像 ✅  
**下一步**: 自动部署到 K8s（Flux Image Automation）
