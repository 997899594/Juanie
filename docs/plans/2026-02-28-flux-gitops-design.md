# Juanie Flux GitOps 架构设计

> **目标**: 设计一个现代化的 GitOps 部署架构，支持主应用和多个子应用的自动化部署

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Juanie 平台                               │
│                                                                  │
│  ┌──────────┐    ┌──────────────────────────────────────────┐  │
│  │ 用户 UI  │───→│  Juanie 控制器                           │  │
│  └──────────┘    │  - 创建/管理用户仓库                     │  │
│                  │  - 注入 CI 配置                           │  │
│                  │  - 更新主仓库部署配置                     │  │
│                  │  - 管理 Helm Charts                       │  │
│                  └──────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  主应用仓库    │    │  子应用仓库 A   │    │  子应用仓库 B   │
│  (Juanie)     │    │  (用户项目)     │    │  (用户项目)     │
│               │    │                 │    │                 │
│  apps/        │    │  src/           │    │  src/           │
│  charts/      │    │  .github/       │    │  .github/       │
│  infrastructure/│   │  (CI注入)      │    │  (CI注入)      │
└───────┬───────┘    └────────┬────────┘    └────────┬────────┘
        │                     │                      │
        │ Flux 监听           │ CI 构建              │ CI 构建
        │                     ▼                      ▼
        │              ┌─────────────────────────────────┐
        │              │        ghcr.io                  │
        │              │  - juanie:latest                │
        │              │  - project-a:latest             │
        │              │  - project-b:latest             │
        │              └─────────────────────────────────┘
        │                              │
        ▼                              │ CI 触发 webhook
┌──────────────────────────────────────┼───────────────────────────┐
│                         Kubernetes 集群                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 共享 Gateway (*.juanie.art)                                 │ │
│  │   ├── juanie.art        → juanie-web                       │ │
│  │   ├── note.juanie.art   → nexusnote-web                    │ │
│  │   └── app-a.juanie.art  → app-a-web                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ ns: juanie  │  │ ns: app-a   │  │ ns: app-b   │  ...         │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

## 2. 目录结构

### 2.1 主应用仓库（Juanie）

```
juaniew-repo/
├── deploy/flux/
│   ├── clusters/
│   │   └── production/
│   │       ├── git-repository.yaml    # GitRepository（纳入 GitOps）
│   │       ├── infrastructure.yaml    # 基础设施 Kustomization
│   │       └── apps.yaml              # 应用 Kustomization
│   │
│   ├── infrastructure/
│   │   ├── cert-manager/
│   │   │   └── cluster-issuer.yaml
│   │   └── gateway/
│   │       ├── gateway.yaml           # 共享 Gateway (*.juanie.art)
│   │       └── kustomization.yaml
│   │
│   ├── apps/
│   │   └── base/
│   │       ├── kustomization.yaml     # 引用所有子应用
│   │       ├── juanie/                # 主应用配置
│   │       │   ├── kustomization.yaml
│   │       │   ├── helm-release.yaml
│   │       │   ├── image-repository.yaml
│   │       │   ├── image-policy.yaml
│   │       │   └── image-update.yaml
│   │       ├── nexusnote/             # 子应用配置（平台自动创建）
│   │       │   ├── kustomization.yaml
│   │       │   ├── helm-release.yaml
│   │       │   └── ...
│   │       └── ...                    # 更多子应用
│   │
│   └── charts/
│       ├── juanie/                    # 主应用 Helm Chart
│       │   ├── Chart.yaml
│       │   ├── values.yaml
│       │   └── templates/
│       ├── app-template/              # 通用子应用 Chart 模板
│       │   ├── Chart.yaml
│       │   ├── values.yaml
│       │   └── templates/
│       │       ├── deployment.yaml
│       │       ├── service.yaml
│       │       ├── httproute.yaml     # 指向共享 Gateway
│       │       └── ...
│       └── nexusnote/                 # 特殊需求子应用 Chart（可选）
│
├── src/                               # Juanie 平台代码
└── ...
```

### 2.2 子应用仓库（用户项目，平台自动创建）

```
user-project-repo/
├── src/                               # 用户代码
├── public/
├── package.json
└── .github/
    └── workflows/
        └── juanie-ci.yml             # 平台自动注入的 CI 配置
```

## 3. 核心组件设计

### 3.1 共享 Gateway（通配符域名）

```yaml
# infrastructure/gateway/gateway.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: infrastructure
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    io.cilium/lb-ipam-ips: "10.2.0.15"
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: "*.juanie.art"
      allowedRoutes:
        namespaces:
          from: All  # 允许所有 namespace 的 HTTPRoute
    - name: https
      protocol: HTTPS
      port: 443
      hostname: "*.juanie.art"
      allowedRoutes:
        namespaces:
          from: All
      tls:
        mode: Terminate
        certificateRefs:
          - name: juanie-wildcard-tls
```

### 3.2 GitRepository（纳入 GitOps 管理）

```yaml
# clusters/production/git-repository.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/997899594/Juanie.git
  ref:
    branch: main
```

### 3.3 子应用 HTTPRoute（指向共享 Gateway）

```yaml
# charts/app-template/templates/httproute.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Values.app.name }}-route
  namespace: {{ .Values.app.namespace }}
spec:
  parentRefs:
    - name: shared-gateway
      namespace: infrastructure
      sectionName: https
  hostnames:
    - {{ .Values.app.hostname }}  # e.g., "note.juanie.art"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: {{ .Values.app.name }}-web
          port: {{ .Values.app.port | default 3000 }}
```

### 3.4 子应用 CI 配置（平台注入）

```yaml
# .github/workflows/juanie-ci.yml（平台自动创建）
name: Juanie CI/CD

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push image
        run: |
          docker build -t ghcr.io/${{ vars.JUANIE_ORG }}/${{ vars.APP_NAME }}:latest .
          docker push ghcr.io/${{ vars.JUANIE_ORG }}/${{ vars.APP_NAME }}:latest

      - name: Trigger Flux reconcile
        run: |
          curl -X POST ${{ secrets.FLUX_WEBHOOK_URL }}
```

## 4. 部署流程

### 4.1 创建新项目流程

```
用户在 UI 点击"创建项目"
        ↓
Juanie 控制器执行：
        ├── 1. 创建用户 Git 仓库（或授权现有仓库）
        ├── 2. 注入 CI 配置到仓库
        ├── 3. 在主仓库 apps/base/ 下创建部署配置
        ├── 4. 分配子域名（xxx.juanie.art）
        ├── 5. 提交主仓库变更
        └── 6. 通知 Flux 同步
        ↓
Flux 自动部署新应用
```

### 4.2 代码更新流程

```
用户 git push 到子应用仓库
        ↓
GitHub Actions 触发：
        ├── 1. 构建镜像
        ├── 2. 推送到 ghcr.io（tag: latest）
        └── 3. 调用 Flux webhook
        ↓
Flux reconcile
        ↓
K8s 拉取最新镜像（imagePullPolicy: Always）
        ↓
应用更新完成
```

## 5. 关键配置

### 5.1 镜像策略

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 镜像 tag | `latest` 或 `sha-${commit}` | 固定 tag，配合 Always 拉取 |
| imagePullPolicy | `Always` | 确保每次都拉取最新镜像 |
| Flux 同步间隔 | 1 分钟 | 快速检测配置变更 |

### 5.2 证书管理

- 使用 cert-managier + Let's Encrypt
- 通配符证书 `*.juanie.art`
- DNS-01 验证（推荐）或 HTTP-01 验证

### 5.3 命名规范

| 资源 | 命名规则 | 示例 |
|------|----------|------|
| Namespace | `{app-name}` | `nexusnote` |
| 镜像 | `ghcr.io/{org}/{app-name}:latest` | `ghcr.io/997899594/nexusnote:latest` |
| 域名 | `{app-name}.juanie.art` | `note.juanie.art` |

## 6. 与传统方案对比

| 对比项 | 传统方案（每个应用单独监听） | 本方案（统一监听） |
|--------|---------------------------|------------------|
| Flux GitRepository | 每个应用一个 | 一个，监听主仓库 |
| Flux Kustomization | 每个应用一个 | 一个，自动发现 |
| 新增应用 | 手动配置 Flux 资源 | 平台自动创建配置文件 |
| 配置管理 | 分散在多个仓库 | 集中在主仓库 |
| Gateway | 每个应用一个 | 共享一个，通配符域名 |

## 7. 待实现功能

1. **GitRepository 纳入 GitOps** - 当前在服务器手动创建
2. **共享 Gateway 通配符域名** - 当前只支持单域名
3. **通用子应用 Chart 模板** - 简化新应用创建
4. **CI 配置自动注入** - 平台自动管理
5. **Flux webhook 触发** - 替代手动 reconcile

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 主仓库单点故障 | 定期备份，使用 Git 分支保护 |
| 通配符证书泄露 | 监控证书使用，定期轮换 |
| 平台故障影响所有应用 | Juanie 自身高可用部署 |
