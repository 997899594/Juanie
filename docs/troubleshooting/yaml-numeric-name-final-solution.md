# YAML 纯数字名称问题 - 最终解决方案

## 问题描述

用户创建纯数字项目名称（如 "8888", "080"）时，Kustomize 部署失败。

**错误现象**：
```yaml
# ❌ 错误 - YAML 将纯数字解析为整数
name: 080  # 被解析为整数 80（八进制）
name: 8888 # 被解析为整数 8888
```

## 根本原因

YAML 规范会自动推断类型：
- `080` → 八进制整数 64
- `8888` → 十进制整数 8888
- `1e10` → 科学计数法浮点数

但 Kubernetes 资源名称必须是字符串类型。

## 解决方案：使用项目 ID（UUID）

**核心思路**：使用 `projectId`（UUID 格式）作为 K8s 资源名称，而不是 `projectName`（可能是纯数字）。

### 优势

1. **UUID 永远不会有类型推断问题** - 格式如 `cbae1dc7-8646-460a-bdcd-c4ab0fe0404d`
2. **简单直接** - 无需任何特殊处理
3. **全局唯一** - 避免命名冲突
4. **符合 K8s 最佳实践** - 使用稳定的标识符

### 变量使用规则

| 用途 | 使用变量 | 原因 |
|------|---------|------|
| 资源名称 | `projectId` | 避免纯数字问题，全局唯一 |
| Label 选择器 | `projectId` | 必须与资源名称一致 |
| 显示标签 | `projectName` | 用户友好，便于识别 |
| 镜像名称 | `projectName` | 用户友好，符合习惯 |
| 域名 | `projectName` | 用户友好，易记 |

### 实施方案

#### 1. Deployment - 资源名称和选择器使用 projectId

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <%= projectId %>  # ✅ UUID，避免纯数字问题
  labels:
    project-name: <%= projectName %>  # ✅ 显示标签，用户友好
spec:
  selector:
    matchLabels:
      app: <%= projectId %>  # ✅ 选择器，必须与 Pod label 一致
  template:
    metadata:
      labels:
        app: <%= projectId %>  # ✅ Pod label，用于选择器匹配
    spec:
      containers:
      - name: app
        image: ghcr.io/<%= githubUsername %>/<%= projectName %>:latest  # ✅ 镜像名称使用 projectName
```

#### 2. Service - 选择器使用 projectId

```yaml
apiVersion: v1
kind: Service
metadata:
  name: <%= projectId %>  # ✅ UUID
  labels:
    project-name: <%= projectName %>  # ✅ 显示标签
spec:
  selector:
    app: <%= projectId %>  # ✅ 选择 Pod
```

#### 3. Ingress - 域名使用 projectName

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: <%= projectId %>  # ✅ UUID
  labels:
    project-name: <%= projectName %>  # ✅ 显示标签
spec:
  rules:
  - host: <%= projectName %>.example.com  # ✅ 域名使用 projectName
```

## 修改的文件

**K8s Base 资源**：
- `templates/nextjs-15-app/k8s/base/deployment.yaml`
- `templates/nextjs-15-app/k8s/base/service.yaml`
- `templates/nextjs-15-app/k8s/base/ingress.yaml`
- `templates/nextjs-15-app/k8s/base/kustomization.yaml`

**Kustomize Overlays**：
- `templates/nextjs-15-app/k8s/overlays/development/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml`
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/staging/deployment-patch.yaml`
- `templates/nextjs-15-app/k8s/overlays/production/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/production/deployment-patch.yaml`
- `templates/nextjs-15-app/k8s/overlays/production/hpa.yaml`

## 验证

创建纯数字项目（如 "080"），检查生成的 YAML：

```yaml
# ✅ 正确 - 使用 UUID 作为资源名称
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cbae1dc7-8646-460a-bdcd-c4ab0fe0404d
  labels:
    project-name: "080"  # 显示标签
spec:
  replicas: 1  # ✅ 数字类型，正确
  selector:
    matchLabels:
      app: cbae1dc7-8646-460a-bdcd-c4ab0fe0404d
  template:
    metadata:
      labels:
        app: cbae1dc7-8646-460a-bdcd-c4ab0fe0404d
    spec:
      containers:
      - name: app
        image: ghcr.io/username/080:latest  # ✅ 镜像名称使用 projectName
        ports:
        - containerPort: 3000  # ✅ 数字类型，正确
```

## 数字类型字段验证

以下字段使用数字类型，无需引号：

```yaml
replicas: 1              # ✅ 副本数
containerPort: 3000      # ✅ 容器端口
port: 80                 # ✅ Service 端口
initialDelaySeconds: 30  # ✅ 探针延迟
periodSeconds: 10        # ✅ 探针周期
minReplicas: 2           # ✅ HPA 最小副本
maxReplicas: 10          # ✅ HPA 最大副本
averageUtilization: 70   # ✅ CPU 利用率
```

## 总结

- ✅ 使用 `projectId`（UUID）作为 K8s 资源名称和选择器
- ✅ 使用 `projectName` 作为显示标签、镜像名称和域名（用户友好）
- ✅ 简洁、正确、符合最佳实践
- ✅ 数字类型字段无需特殊处理
- ✅ 避免冗余 label，只保留必要的标识
