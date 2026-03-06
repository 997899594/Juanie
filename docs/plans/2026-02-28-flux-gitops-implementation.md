# Flux GitOps 架构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构 Flux GitOps 架构，支持主应用和子应用的统一管理，使用共享 Gateway 和通配符域名

**Architecture:**
- 共享 Gateway（`*.juanie.art`）替代每个应用独立 Gateway
- GitRepository 纳入 GitOps 管理，不再手动创建
- 通用子应用 Chart 模板简化新应用部署
- 子应用 HTTPRoute 指向共享 Gateway

**Tech Stack:** Flux CD v2, Helm, Cilium Gateway API, cert-manager, SOPS

---

## Task 1: 创建共享 Gateway（通配符域名）

**Files:**
- Create: `deploy/flux/infrastructure/gateway/kustomization.yaml`
- Create: `deploy/flux/infrastructure/gateway/gateway.yaml`
- Create: `deploy/flux/infrastructure/gateway/certificate.yaml`
- Modify: `deploy/flux/infrastructure/kustomization.yaml`

**Step 1: 创建 gateway 目录和 kustomization**

```bash
mkdir -p deploy/flux/infrastructure/gateway
```

**Step 2: 创建共享 Gateway**

Create: `deploy/flux/infrastructure/gateway/gateway.yaml`

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: juanie
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
          from: All
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
            group: ""
            kind: Secret
```

**Step 3: 创建通配符证书**

Create: `deploy/flux/infrastructure/gateway/certificate.yaml`

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: juanie-wildcard-tls
  namespace: juanie
spec:
  secretName: juanie-wildcard-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - "*.juanie.art"
```

**Step 4: 创建 gateway kustomization**

Create: `deploy/flux/infrastructure/gateway/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - gateway.yaml
  - certificate.yaml
```

**Step 5: 更新 infrastructure kustomization**

Modify: `deploy/flux/infrastructure/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - cert-manager
  - gateway
```

**Step 6: 提交**

```bash
git add deploy/flux/infrastructure/
git commit -m "feat: 添加共享 Gateway 和通配符证书

- 创建共享 Gateway (*.juanie.art)
- 支持所有 namespace 的 HTTPRoute
- 配置通配符 TLS 证书

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 创建 GitRepository 资源（纳入 GitOps）

**Files:**
- Create: `deploy/flux/clusters/production/git-repository.yaml`
- Modify: `deploy/flux/clusters/production/infrastructure.yaml`
- Modify: `deploy/flux/clusters/production/apps.yaml`

**Step 1: 创建 GitRepository 资源**

Create: `deploy/flux/clusters/production/git-repository.yaml`

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  url: https://gh-proxy.com/https://github.com/997899594/Juanie.git
  ref:
    branch: main
```

**Step 2: 更新 infrastructure.yaml 引用**

Modify: `deploy/flux/clusters/production/infrastructure.yaml`

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: infrastructure
  namespace: flux-system
spec:
  interval: 10m0s
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./deploy/flux/infrastructure
  prune: true
  wait: true
  timeout: 5m0s
```

**Step 3: 更新 apps.yaml 引用**

Modify: `deploy/flux/clusters/production/apps.yaml`

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 1m0s
  dependsOn:
    - name: infrastructure
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./deploy/flux/apps/base
  prune: true
  wait: true
  timeout: 10m0s
```

**Step 4: 提交**

```bash
git add deploy/flux/clusters/production/
git commit -m "feat: GitRepository 纳入 GitOps 管理

- 创建 GitRepository 资源定义
- 使用 gh-proxy.com 代理
- 缩短 apps 同步间隔到 1 分钟

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 重构 Juanie Chart 使用共享 Gateway

**Files:**
- Delete: `deploy/flux/charts/juanie/templates/gateway.yaml`
- Modify: `deploy/flux/charts/juanie/templates/httproute.yaml`
- Modify: `deploy/flux/charts/juanie/templates/certificate.yaml`
- Modify: `deploy/flux/charts/juanie/values.yaml`

**Step 1: 删除独立 Gateway 模板**

```bash
rm deploy/flux/charts/juanie/templates/gateway.yaml
```

**Step 2: 更新 HTTPRoute 指向共享 Gateway**

Modify: `deploy/flux/charts/juanie/templates/httproute.yaml`

```yaml
# HTTPS 路由
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Chart.Name }}-route
  namespace: {{ .Values.namespace }}
spec:
  parentRefs:
    - name: shared-gateway
      namespace: juanie
      sectionName: https
  hostnames:
    - {{ .Values.hostname }}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: {{ .Chart.Name }}-web
          port: 80
---
# HTTP 到 HTTPS 重定向
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Chart.Name }}-redirect
  namespace: {{ .Values.namespace }}
spec:
  parentRefs:
    - name: shared-gateway
      namespace: juanie
      sectionName: http
  hostnames:
    - {{ .Values.hostname }}
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
```

**Step 3: 删除独立证书模板（使用共享通配符证书）**

```bash
rm deploy/flux/charts/juanie/templates/certificate.yaml
```

**Step 4: 更新 values.yaml 移除 loadBalancerIP**

Modify: `deploy/flux/charts/juanie/values.yaml`

删除 `loadBalancerIP` 字段（共享 Gateway 已配置）

**Step 5: 提交**

```bash
git add deploy/flux/charts/juanie/
git commit -m "refactor: Juanie Chart 使用共享 Gateway

- 删除独立 Gateway 模板
- HTTPRoute 指向共享 Gateway
- 删除独立证书，使用通配符证书

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 创建通用子应用 Chart 模板

**Files:**
- Create: `deploy/flux/charts/app-template/Chart.yaml`
- Create: `deploy/flux/charts/app-template/values.yaml`
- Create: `deploy/flux/charts/app-template/templates/namespace.yaml`
- Create: `deploy/flux/charts/app-template/templates/deployment.yaml`
- Create: `deploy/flux/charts/app-template/templates/service.yaml`
- Create: `deploy/flux/charts/app-template/templates/httproute.yaml`
- Create: `deploy/flux/charts/app-template/templates/configmap.yaml`
- Create: `deploy/flux/charts/app-template/templates/secret.yaml`

**Step 1: 创建目录结构**

```bash
mkdir -p deploy/flux/charts/app-template/templates
```

**Step 2: 创建 Chart.yaml**

Create: `deploy/flux/charts/app-template/Chart.yaml`

```yaml
apiVersion: v2
name: app-template
description: 通用子应用 Helm Chart 模板
type: application
version: 0.1.0
appVersion: "1.0.0"
```

**Step 3: 创建 values.yaml**

Create: `deploy/flux/charts/app-template/values.yaml`

```yaml
# 应用配置
app:
  name: ""
  namespace: ""
  hostname: ""
  port: 3000

# 镜像配置
image:
  repository: ""
  pullPolicy: Always
  tag: "latest"

# 副本数
replicaCount: 1

# 资源配置
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

# 环境变量（非敏感）
env: {}

# 敏感配置
secret: {}
```

**Step 4: 创建 namespace.yaml**

Create: `deploy/flux/charts/app-template/templates/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Values.app.namespace }}
  labels:
    app.kubernetes.io/managed-by: juanie
```

**Step 5: 创建 deployment.yaml**

Create: `deploy/flux/charts/app-template/templates/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.app.name }}-web
  namespace: {{ .Values.app.namespace }}
  labels:
    app: {{ .Values.app.name }}-web
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Values.app.name }}-web
  template:
    metadata:
      labels:
        app: {{ .Values.app.name }}-web
    spec:
      containers:
        - name: web
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.app.port }}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: {{ .Values.app.name }}-config
            - secretRef:
                name: {{ .Values.app.name }}-secret
                optional: true
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

**Step 6: 创建 service.yaml**

Create: `deploy/flux/charts/app-template/templates/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.app.name }}-web
  namespace: {{ .Values.app.namespace }}
spec:
  type: ClusterIP
  selector:
    app: {{ .Values.app.name }}-web
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
```

**Step 7: 创建 httproute.yaml**

Create: `deploy/flux/charts/app-template/templates/httproute.yaml`

```yaml
# HTTPS 路由
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Values.app.name }}-route
  namespace: {{ .Values.app.namespace }}
spec:
  parentRefs:
    - name: shared-gateway
      namespace: juanie
      sectionName: https
  hostnames:
    - {{ .Values.app.hostname }}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: {{ .Values.app.name }}-web
          port: 80
---
# HTTP 重定向
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Values.app.name }}-redirect
  namespace: {{ .Values.app.namespace }}
spec:
  parentRefs:
    - name: shared-gateway
      namespace: juanie
      sectionName: http
  hostnames:
    - {{ .Values.app.hostname }}
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
```

**Step 8: 创建 configmap.yaml**

Create: `deploy/flux/charts/app-template/templates/configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ .Values.app.name }}-config
  namespace: {{ .Values.app.namespace }}
data:
  {{- range $key, $value := .Values.env }}
  {{ $key }}: {{ $value | quote }}
  {{- end }}
```

**Step 9: 创建 secret.yaml**

Create: `deploy/flux/charts/app-template/templates/secret.yaml`

```yaml
{{- if .Values.secret }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.app.name }}-secret
  namespace: {{ .Values.app.namespace }}
type: Opaque
stringData:
  {{- range $key, $value := .Values.secret }}
  {{ $key }}: {{ $value | quote }}
  {{- end }}
{{- end }}
```

**Step 10: 提交**

```bash
git add deploy/flux/charts/app-template/
git commit -m "feat: 添加通用子应用 Chart 模板

- 支持快速创建新子应用
- 使用共享 Gateway
- 包含 Deployment/Service/HTTPRoute/ConfigMap/Secret

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 修复当前 values.yaml secret 问题

**Files:**
- Modify: `deploy/flux/charts/juanie/values.yaml`

**Step 1: 检查当前 values.yaml**

确保 secret 部分没有重复定义，值正确填写。

**Step 2: 修复 values.yaml**

Modify: `deploy/flux/charts/juanie/values.yaml`

确保文件末尾只有一个 secret 块，值正确：

```yaml
# 敏感配置
secret:
  existingSecret: ""
  databasePassword: "postgres"
  nextauthSecret: "juanie-nextauth-secret-2024"
  githubClientId: ""
  githubClientSecret: ""
  gitlabClientId: ""
  gitlabClientSecret: ""
```

**Step 3: 提交**

```bash
git add deploy/flux/charts/juanie/values.yaml
git commit -m "fix: 确保 values.yaml secret 配置正确

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 更新服务器并验证

**Step 1: 推送所有更改**

```bash
git push
```

**Step 2: 在服务器上删除旧的 GitRepository（如果存在）**

```bash
ssh root@49.232.237.136 "kubectl delete gitrepository flux-system -n flux-system 2>/dev/null || true"
```

**Step 3: 删除旧的 HelmChart 缓存**

```bash
ssh root@49.232.237.136 "kubectl delete helmchart.source.toolkit.fluxcd.io -n flux-system --all"
```

**Step 4: 应用新的 GitRepository**

```bash
ssh root@49.232.237.136 "kubectl apply -f -" << 'EOF'
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  url: https://gh-proxy.com/https://github.com/997899594/Juanie.git
  ref:
    branch: main
EOF
```

**Step 5: 触发同步**

```bash
ssh root@49.232.237.136 "flux reconcile kustomization infrastructure --with-source && flux reconcile kustomization apps --with-source"
```

**Step 6: 验证 Gateway 和 HTTPRoute**

```bash
ssh root@49.232.237.136 "kubectl get gateway -A && kubectl get httproute -A"
```

**Step 7: 验证应用访问**

```bash
curl -I https://juanie.art
```

---

## Task 7: 更新 init-server.sh 脚本

**Files:**
- Modify: `deploy/flux/scripts/init-server.sh`

**Step 1: 更新脚本使用新的 GitRepository 配置**

Modify: `deploy/flux/scripts/init-server.sh`

将手动创建 GitRepository 的部分改为应用仓库中的配置：

```bash
# 3. 应用 GitRepository（从仓库配置）
echo ""
echo "=== 3. 应用 GitRepository ==="
kubectl apply -f - <<EOF
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  url: https://gh-proxy.com/https://github.com/997899594/Juanie.git
  ref:
    branch: main
EOF
```

**Step 2: 提交**

```bash
git add deploy/flux/scripts/init-server.sh
git commit -m "refactor: 更新 init-server.sh 使用新的 GitRepository 配置

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验证清单

- [ ] 共享 Gateway 创建成功，hostname 为 `*.juanie.art`
- [ ] 通配符证书 `juanie-wildcard-tls` 创建成功
- [ ] Juanie HTTPRoute 指向共享 Gateway
- [ ] `juanie.art` 可正常访问
- [ ] GitRepository 从仓库配置中创建
- [ ] Flux 自动同步正常（1 分钟间隔）
- [ ] 通用子应用 Chart 模板可用于新应用
