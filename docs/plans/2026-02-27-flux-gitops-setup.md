# Flux GitOps Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 Flux + Helm + SOPS 替换现有的 k8s/ 目录，实现完全 GitOps 化的部署流程。

**Architecture:** Flux bootstrap 安装并管理自己，通过 GitRepository 监听仓库变化，使用 HelmRelease 部署应用，ImageAutomation 实现镜像自动更新，SOPS 加密敏感信息。

**Tech Stack:** Flux CD v2, Helm, SOPS (age), cert-manager, Cilium Gateway API

---

## Prerequisites

- 服务器已安装 k3s
- 已有 GitHub 仓库访问权限
- 域名 DNS 已指向服务器

---

## Task 1: 创建目录结构

**Files:**
- Create: `clusters/production/.gitkeep`
- Create: `infrastructure/cert-manager/.gitkeep`
- Create: `apps/base/juanie/.gitkeep`
- Create: `charts/juanie/.gitkeep`

**Step 1: 创建目录**

```bash
mkdir -p clusters/production
mkdir -p infrastructure/cert-manager
mkdir -p apps/base/juanie
mkdir -p charts/juanie/templates
touch clusters/production/.gitkeep
touch infrastructure/cert-manager/.gitkeep
touch apps/base/juanie/.gitkeep
touch charts/juanie/.gitkeep
```

**Step 2: 验证目录结构**

Run: `tree -L 3 clusters infrastructure apps charts`

Expected:
```
apps
└── base
    └── juanie
        └── .gitkeep
charts
└── juanie
    ├── .gitkeep
    └── templates
clusters
└── production
    └── .gitkeep
infrastructure
└── cert-manager
    └── .gitkeep
```

**Step 3: Commit**

```bash
git add clusters infrastructure apps charts
git commit -m "chore: 创建 Flux GitOps 目录结构"
```

---

## Task 2: 创建 Helm Chart 基础文件

**Files:**
- Create: `charts/juanie/Chart.yaml`
- Create: `charts/juanie/values.yaml`
- Create: `charts/juanie/values-prod.yaml`

**Step 1: 创建 Chart.yaml**

```yaml
# charts/juanie/Chart.yaml
apiVersion: v2
name: juanie
description: Juanie DevOps Platform
type: application
version: 0.1.0
appVersion: "1.0.0"
```

**Step 2: 创建 values.yaml**

```yaml
# charts/juanie/values.yaml
# 默认配置（开发环境）
image:
  repository: ghcr.io/997899594/juanie
  pullPolicy: IfNotPresent
  tag: "latest"

namespace: juanie

# 副本数
replicaCount:
  web: 1
  worker: 1

# 资源配置
resources:
  web:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  worker:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

# 环境变量（非敏感）
env:
  NODE_ENV: "production"
  PORT: 3001
  REDIS_HOST: "redis"
  REDIS_PORT: 6379
  DATABASE_HOST: "postgres"
  DATABASE_PORT: 5432
  DATABASE_NAME: "juanie"

# Gateway 配置
hostname: "juanie.art"
loadBalancerIP: "10.2.0.16"

# 数据库配置
postgres:
  storage: "10Gi"

redis:
  storage: "1Gi"
```

**Step 3: 创建 values-prod.yaml**

```yaml
# charts/juanie/values-prod.yaml
# 生产环境覆盖配置
replicaCount:
  web: 2
  worker: 1

resources:
  web:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi
```

**Step 4: Commit**

```bash
git add charts/juanie/Chart.yaml charts/juanie/values.yaml charts/juanie/values-prod.yaml
git commit -m "feat: 创建 Juanie Helm Chart 基础配置"
```

---

## Task 3: 创建 Namespace 和基础资源模板

**Files:**
- Create: `charts/juanie/templates/namespace.yaml`
- Create: `charts/juanie/templates/serviceaccount.yaml`
- Create: `charts/juanie/templates/service.yaml`

**Step 1: 创建 namespace.yaml**

```yaml
# charts/juanie/templates/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/managed-by: Helm
```

**Step 2: 创建 serviceaccount.yaml**

```yaml
# charts/juanie/templates/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Chart.Name }}
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
automountServiceAccountToken: true
```

**Step 3: 创建 service.yaml**

```yaml
# charts/juanie/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Chart.Name }}-web
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/component: web
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/component: web
```

**Step 4: Commit**

```bash
git add charts/juanie/templates/
git commit -m "feat: 添加 Namespace、ServiceAccount、Service 模板"
```

---

## Task 4: 创建 ConfigMap 和 Secret 模板

**Files:**
- Create: `charts/juanie/templates/configmap.yaml`
- Create: `charts/juanie/templates/secret.sops.yaml`

**Step 1: 创建 configmap.yaml**

```yaml
# charts/juanie/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ .Chart.Name }}-config
  namespace: {{ .Values.namespace }}
data:
  NODE_ENV: {{ .Values.env.NODE_ENV | quote }}
  PORT: {{ .Values.env.PORT | quote }}
  REDIS_HOST: {{ .Values.env.REDIS_HOST | quote }}
  REDIS_PORT: {{ .Values.env.REDIS_PORT | quote }}
  DATABASE_HOST: {{ .Values.env.DATABASE_HOST | quote }}
  DATABASE_PORT: {{ .Values.env.DATABASE_PORT | quote }}
  DATABASE_NAME: {{ .Values.env.DATABASE_NAME | quote }}
```

**Step 2: 创建 secret.sops.yaml (占位，稍后加密)**

```yaml
# charts/juanie/templates/secret.sops.yaml
# 此文件需要用 SOPS 加密后提交
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Chart.Name }}-secret
  namespace: {{ .Values.namespace }}
type: Opaque
stringData:
  # 敏感信息占位，实际值用 SOPS 加密
  DATABASE_URL: "postgresql://postgres:CHANGE_ME@postgres:5432/juanie"
  NEXTAUTH_SECRET: "CHANGE_ME"
  NEXTAUTH_URL: "https://juanie.art"
  GITHUB_CLIENT_ID: "CHANGE_ME"
  GITHUB_CLIENT_SECRET: "CHANGE_ME"
  GITLAB_CLIENT_ID: "CHANGE_ME"
  GITLAB_CLIENT_SECRET: "CHANGE_ME"
```

**Step 3: Commit**

```bash
git add charts/juanie/templates/configmap.yaml charts/juanie/templates/secret.sops.yaml
git commit -m "feat: 添加 ConfigMap 和 Secret 模板"
```

---

## Task 5: 创建 PostgreSQL 和 Redis 模板

**Files:**
- Create: `charts/juanie/templates/postgres.yaml`
- Create: `charts/juanie/templates/redis.yaml`

**Step 1: 创建 postgres.yaml**

```yaml
# charts/juanie/templates/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: postgres
  template:
    metadata:
      labels:
        app.kubernetes.io/name: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: {{ .Values.env.DATABASE_NAME }}
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Chart.Name }}-secret
                  key: POSTGRES_PASSWORD
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: {{ .Values.postgres.storage }}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: {{ .Values.namespace }}
spec:
  type: ClusterIP
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app.kubernetes.io/name: postgres
```

**Step 2: 创建 redis.yaml**

```yaml
# charts/juanie/templates/redis.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: redis
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: redis
  template:
    metadata:
      labels:
        app.kubernetes.io/name: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: redis-data
              mountPath: /data
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 256Mi
  volumeClaimTemplates:
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: {{ .Values.redis.storage }}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: {{ .Values.namespace }}
spec:
  type: ClusterIP
  ports:
    - port: 6379
      targetPort: 6379
  selector:
    app.kubernetes.io/name: redis
```

**Step 3: 更新 secret.sops.yaml 添加 POSTGRES_PASSWORD**

在 `charts/juanie/templates/secret.sops.yaml` 的 `stringData` 中添加：

```yaml
  POSTGRES_PASSWORD: "CHANGE_ME"
```

**Step 4: Commit**

```bash
git add charts/juanie/templates/postgres.yaml charts/juanie/templates/redis.yaml charts/juanie/templates/secret.sops.yaml
git commit -m "feat: 添加 PostgreSQL 和 Redis StatefulSet 模板"
```

---

## Task 6: 创建 Deployment 模板

**Files:**
- Create: `charts/juanie/templates/deployment.yaml`

**Step 1: 创建 deployment.yaml**

```yaml
# charts/juanie/templates/deployment.yaml
# Web Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}-web
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/component: web
spec:
  replicas: {{ .Values.replicaCount.web }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Chart.Name }}
      app.kubernetes.io/component: web
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ .Chart.Name }}
        app.kubernetes.io/component: web
    spec:
      serviceAccountName: {{ .Chart.Name }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      initContainers:
        - name: wait-for-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-for-redis
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z redis 6379; do echo waiting for redis; sleep 2; done']
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.env.PORT }}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: {{ .Chart.Name }}-config
            - secretRef:
                name: {{ .Chart.Name }}-secret
          resources:
            {{- toYaml .Values.resources.web | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
      terminationGracePeriodSeconds: 30
---
# Worker Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}-worker
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/component: worker
spec:
  replicas: {{ .Values.replicaCount.worker }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Chart.Name }}
      app.kubernetes.io/component: worker
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ .Chart.Name }}
        app.kubernetes.io/component: worker
    spec:
      serviceAccountName: {{ .Chart.Name }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      initContainers:
        - name: wait-for-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done']
        - name: wait-for-redis
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z redis 6379; do echo waiting for redis; sleep 2; done']
      containers:
        - name: worker
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          command: ["bun", "run", "start:worker"]
          envFrom:
            - configMapRef:
                name: {{ .Chart.Name }}-config
            - secretRef:
                name: {{ .Chart.Name }}-secret
          resources:
            {{- toYaml .Values.resources.worker | nindent 12 }}
          livenessProbe:
            exec:
              command: ["sh", "-c", "ps aux | grep 'bun.*worker' | grep -v grep"]
            initialDelaySeconds: 30
            periodSeconds: 30
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
      terminationGracePeriodSeconds: 30
```

**Step 2: Commit**

```bash
git add charts/juanie/templates/deployment.yaml
git commit -m "feat: 添加 Web 和 Worker Deployment 模板"
```

---

## Task 7: 创建 Gateway 和 HTTPRoute 模板

**Files:**
- Create: `charts/juanie/templates/certificate.yaml`
- Create: `charts/juanie/templates/gateway.yaml`
- Create: `charts/juanie/templates/httproute.yaml`

**Step 1: 创建 certificate.yaml**

```yaml
# charts/juanie/templates/certificate.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: {{ .Chart.Name }}-tls
  namespace: {{ .Values.namespace }}
spec:
  secretName: {{ .Chart.Name }}-tls
  dnsNames:
    - {{ .Values.hostname }}
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
    group: cert-manager.io
  renewBefore: 360h
  privateKey:
    rotationPolicy: Always
    algorithm: ECDSA
    size: 256
```

**Step 2: 创建 gateway.yaml**

```yaml
# charts/juanie/templates/gateway.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: {{ .Chart.Name }}-gateway
  namespace: {{ .Values.namespace }}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: cilium
  addresses:
    - type: IPAddress
      value: {{ .Values.loadBalancerIP }}
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: {{ .Values.hostname }}
      allowedRoutes:
        namespaces:
          from: Same
    - name: https
      protocol: HTTPS
      port: 443
      hostname: {{ .Values.hostname }}
      allowedRoutes:
        namespaces:
          from: Same
      tls:
        mode: Terminate
        certificateRefs:
          - name: {{ .Chart.Name }}-tls
            group: ""
            kind: Secret
```

**Step 3: 创建 httproute.yaml**

```yaml
# charts/juanie/templates/httproute.yaml
# HTTPS 路由
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Chart.Name }}-route
  namespace: {{ .Values.namespace }}
spec:
  parentRefs:
    - name: {{ .Chart.Name }}-gateway
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
    - name: {{ .Chart.Name }}-gateway
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

**Step 4: Commit**

```bash
git add charts/juanie/templates/certificate.yaml charts/juanie/templates/gateway.yaml charts/juanie/templates/httproute.yaml
git commit -m "feat: 添加 Certificate、Gateway、HTTPRoute 模板"
```

---

## Task 8: 创建 Flux Infrastructure 配置

**Files:**
- Create: `infrastructure/cert-manager/ks.yaml`
- Create: `infrastructure/cert-manager/cluster-issuer.yaml`
- Create: `clusters/production/infrastructure.yaml`

**Step 1: 创建 cluster-issuer.yaml**

```yaml
# infrastructure/cert-manager/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@juanie.art
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs:
              - name: juanie-gateway
                namespace: juanie
                kind: Gateway
                sectionName: http
```

**Step 2: 创建 ks.yaml**

```yaml
# infrastructure/cert-manager/ks.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: cert-manager-configs
  namespace: flux-system
spec:
  interval: 10m0s
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./infrastructure/cert-manager
  prune: true
  wait: true
  timeout: 5m0s
```

**Step 3: 创建 clusters/production/infrastructure.yaml**

```yaml
# clusters/production/infrastructure.yaml
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
  path: ./infrastructure
  prune: true
  wait: true
  timeout: 5m0s
```

**Step 4: Commit**

```bash
git add infrastructure/ clusters/production/infrastructure.yaml
git commit -m "feat: 添加 Flux Infrastructure Kustomization 配置"
```

---

## Task 9: 创建 Flux Apps 配置

**Files:**
- Create: `apps/base/juanie/helm-release.yaml`
- Create: `apps/base/juanie/kustomization.yaml`
- Create: `clusters/production/apps.yaml`

**Step 1: 创建 helm-release.yaml**

```yaml
# apps/base/juanie/helm-release.yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: juanie
  namespace: flux-system
spec:
  interval: 10m0s
  chart:
    spec:
      chart: ./charts/juanie
      sourceRef:
        kind: GitRepository
        name: flux-system
      valuesFiles:
        - ./charts/juanie/values.yaml
        - ./charts/juanie/values-prod.yaml
  install:
    remediation:
      retries: 3
  upgrade:
    remediation:
      retries: 3
  values: {}
```

**Step 2: 创建 kustomization.yaml**

```yaml
# apps/base/juanie/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - helm-release.yaml
```

**Step 3: 创建 clusters/production/apps.yaml**

```yaml
# clusters/production/apps.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 10m0s
  dependsOn:
    - name: infrastructure
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./apps/base
  prune: true
  wait: true
  timeout: 10m0s
```

**Step 4: Commit**

```bash
git add apps/ clusters/production/apps.yaml
git commit -m "feat: 添加 Flux Apps HelmRelease 配置"
```

---

## Task 10: 创建 Flux Image Automation 配置

**Files:**
- Create: `apps/base/juanie/image-repository.yaml`
- Create: `apps/base/juanie/image-policy.yaml`
- Create: `apps/base/juanie/image-update.yaml`
- Modify: `apps/base/juanie/kustomization.yaml`

**Step 1: 创建 image-repository.yaml**

```yaml
# apps/base/juanie/image-repository.yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageRepository
metadata:
  name: juanie
  namespace: flux-system
spec:
  image: ghcr.io/997899594/juanie
  interval: 5m0s
  provider: generic
```

**Step 2: 创建 image-policy.yaml**

```yaml
# apps/base/juanie/image-policy.yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: juanie
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: juanie
  policy:
    semver:
      range: ">=1.0.0-0"
```

**Step 3: 创建 image-update.yaml**

```yaml
# apps/base/juanie/image-update.yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageUpdateAutomation
metadata:
  name: juanie
  namespace: flux-system
spec:
  interval: 5m0s
  sourceRef:
    kind: GitRepository
    name: flux-system
  update:
    strategy: settlers
    path: ./charts/juanie
  git:
    commit:
      author:
        email: flux-bot@users.noreply.github.com
        name: flux-bot
      messageTemplate: |
        chore: 自动更新镜像 tag
        {{ range .Updated.Images -}}
        - {{.}}
        {{ end -}}
```

**Step 4: 更新 kustomization.yaml**

```yaml
# apps/base/juanie/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - helm-release.yaml
  - image-repository.yaml
  - image-policy.yaml
  - image-update.yaml
```

**Step 5: Commit**

```bash
git add apps/base/juanie/
git commit -m "feat: 添加 Flux Image Automation 配置"
```

---

## Task 11: 配置 SOPS 加密

**Files:**
- Create: `.sops.yaml`
- Modify: `charts/juanie/templates/secret.sops.yaml`

**Step 1: 生成 age key**

```bash
# 生成 age key
age-keygen -o age.key 2> age.pub

# 记录公钥（用于 .sops.yaml）
cat age.pub
```

**Step 2: 创建 .sops.yaml**

```yaml
# .sops.yaml
keys:
  - &flux age:YOUR_AGE_PUBLIC_KEY_HERE
creation_rules:
  - path_regex: .*/templates/secret.*\.yaml$
    encrypted_regex: ^(data|stringData)$
    key_groups:
      - age:
          - YOUR_AGE_PUBLIC_KEY_HERE
```

**Step 3: 加密 secret 文件**

```bash
# 先用真实值编辑 secret
vim charts/juanie/templates/secret.sops.yaml

# 加密
sops --encrypt --in-place charts/juanie/templates/secret.sops.yaml
```

**Step 4: 添加 age.key 到 .gitignore**

```bash
echo "age.key" >> .gitignore
echo "age.pub" >> .gitignore
```

**Step 5: Commit**

```bash
git add .sops.yaml .gitignore charts/juanie/templates/secret.sops.yaml
git commit -m "feat: 配置 SOPS 加密敏感信息"
```

---

## Task 12: 创建初始化脚本

**Files:**
- Create: `scripts/init-server.sh`

**Step 1: 创建 init-server.sh**

```bash
#!/bin/bash
# scripts/init-server.sh
# 新服务器初始化脚本

set -e

echo "=== 1. Bootstrap Flux ==="
flux bootstrap github \
  --owner=997899594 \
  --repository=Juanie \
  --path=clusters/production \
  --personal

echo "=== 2. 创建 SOPS 密钥 Secret ==="
echo "请手动执行:"
echo "  kubectl create secret generic sops-age -n flux-system --from-file=age.agekey=./age.key"

echo "=== 完成 ==="
echo "Flux 将自动同步 Git 仓库并部署所有应用"
```

**Step 2: 设置执行权限**

```bash
chmod +x scripts/init-server.sh
```

**Step 3: Commit**

```bash
git add scripts/
git commit -m "feat: 添加服务器初始化脚本"
```

---

## Task 13: 推送并验证

**Step 1: 推送所有更改**

```bash
git push origin main
```

**Step 2: 在服务器执行 bootstrap**

```bash
# 在服务器上执行
flux bootstrap github \
  --owner=997899594 \
  --repository=Juanie \
  --path=clusters/production \
  --personal

# 导入 SOPS key
kubectl create secret generic sops-age -n flux-system --from-file=age.agekey=./age.key
```

**Step 3: 验证 Flux 同步状态**

```bash
flux get kustomizations
flux get helmreleases
kubectl get pods -n juanie
```

**Step 4: 验证 HTTPS**

```bash
curl -I https://juanie.art
```

---

## Cleanup Tasks

完成后删除旧的 k8s/ 目录：

```bash
git rm -r k8s/
git commit -m "chore: 删除旧的 k8s 目录，迁移到 Flux GitOps"
git push
```

---

## Summary

| 阶段 | 任务数 | 内容 |
|------|--------|------|
| 基础结构 | 1-2 | 目录 + Helm Chart 基础 |
| 应用模板 | 3-7 | Namespace → Deployment → Gateway |
| Flux 配置 | 8-10 | Infrastructure + Apps + ImageAutomation |
| 安全 | 11 | SOPS 加密 |
| 部署 | 12-13 | 初始化脚本 + 验证 |
