#!/bin/bash
# ============================================
# Juanie 一键部署脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量 (请根据实际情况修改)
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-juanie_secure_password_2024}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Juanie DevOps Platform Deployment${NC}"
echo -e "${GREEN}============================================${NC}"

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found${NC}"
    exit 1
fi

# 检查是否提供了 GitHub OAuth 信息
if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo -e "${YELLOW}Warning: GitHub OAuth credentials not provided.${NC}"
    echo -e "${YELLOW}Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.${NC}"
    echo -e "${YELLOW}Example:${NC}"
    echo -e "  export GITHUB_CLIENT_ID=your_client_id"
    echo -e "  export GITHUB_CLIENT_SECRET=your_client_secret"
    echo ""
    read -p "Continue without GitHub OAuth? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Phase 0: 清理旧应用
echo -e "${YELLOW}Phase 0: Cleaning up old applications...${NC}"
kubectl delete namespace nexusnote --ignore-not-found=true --timeout=60s || true
kubectl delete namespace nexusnote-dev --ignore-not-found=true --timeout=60s || true
kubectl delete namespace argocd --ignore-not-found=true --timeout=60s || true
kubectl delete namespace infisical-operator-system --ignore-not-found=true --timeout=60s || true

echo -e "${GREEN}Cleanup completed${NC}"

# 创建 namespace
echo -e "${YELLOW}Creating namespace...${NC}"
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: juanie
  labels:
    name: juanie
    app: juanie-platform
EOF

# 创建 Secret
echo -e "${YELLOW}Creating secrets...${NC}"
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: juanie-secret
  namespace: juanie
type: Opaque
stringData:
  POSTGRES_USER: "juanie"
  POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
  DATABASE_URL: "postgresql://juanie:${POSTGRES_PASSWORD}@postgres:5432/juanie"
  NEXTAUTH_SECRET: "${NEXTAUTH_SECRET}"
  NEXTAUTH_URL: "https://juanie.art"
  GITHUB_CLIENT_ID: "${GITHUB_CLIENT_ID}"
  GITHUB_CLIENT_SECRET: "${GITHUB_CLIENT_SECRET}"
  GITLAB_CLIENT_ID: ""
  GITLAB_CLIENT_SECRET: ""
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  REDIS_PASSWORD: ""
  SENTRY_DSN: ""
  LOKI_URL: "http://loki:3100"
EOF

# 创建 ConfigMap
echo -e "${YELLOW}Creating configmap...${NC}"
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: juanie-config
  namespace: juanie
data:
  NODE_ENV: "production"
  NEXTAUTH_URL: "https://juanie.art"
  PLATFORM_API_URL: "https://juanie.art"
  LOG_LEVEL: "info"
  ENABLE_METRICS: "true"
  ENABLE_TRACING: "false"
EOF

# 部署 PostgreSQL
echo -e "${YELLOW}Deploying PostgreSQL...${NC}"
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: juanie
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: juanie
  labels:
    app: juanie
    component: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: juanie
      component: postgres
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: juanie
        component: postgres
    spec:
      securityContext:
        fsGroup: 999
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - name: postgres
              containerPort: 5432
              protocol: TCP
          env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: juanie-secret
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: juanie-secret
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              value: juanie
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - juanie
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - juanie
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: juanie
  labels:
    app: juanie
    component: postgres
spec:
  type: ClusterIP
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
      protocol: TCP
  selector:
    app: juanie
    component: postgres
EOF

# 部署 Redis
echo -e "${YELLOW}Deploying Redis...${NC}"
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: juanie
  labels:
    app: juanie
    component: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: juanie
      component: redis
  template:
    metadata:
      labels:
        app: juanie
        component: redis
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 999
        fsGroup: 999
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - name: redis
              containerPort: 6379
              protocol: TCP
          command:
            - redis-server
            - --appendonly
            - 'yes'
            - --maxmemory
            - 128mb
            - --maxmemory-policy
            - allkeys-lru
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 100m
              memory: 128Mi
          livenessProbe:
            exec:
              command:
                - redis-cli
                - ping
            initialDelaySeconds: 10
            periodSeconds: 5
          readinessProbe:
            exec:
              command:
                - redis-cli
                - ping
            initialDelaySeconds: 5
            periodSeconds: 3
          volumeMounts:
            - name: redis-data
              mountPath: /data
      volumes:
        - name: redis-data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: juanie
  labels:
    app: juanie
    component: redis
spec:
  type: ClusterIP
  ports:
    - name: redis
      port: 6379
      targetPort: redis
      protocol: TCP
  selector:
    app: juanie
    component: redis
EOF

# 等待数据库就绪
echo -e "${YELLOW}Waiting for PostgreSQL and Redis to be ready...${NC}"
kubectl wait --for=condition=available deployment/postgres -n juanie --timeout=120s
kubectl wait --for=condition=available deployment/redis -n juanie --timeout=60s

# 部署 Juanie Web
echo -e "${YELLOW}Deploying Juanie Web...${NC}"
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: juanie-web
  namespace: juanie
  labels:
    app: juanie
    component: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: juanie
      component: web
  template:
    metadata:
      labels:
        app: juanie
        component: web
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
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
        - name: juanie
          image: juanie:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3001
              protocol: TCP
          envFrom:
            - configMapRef:
                name: juanie-config
            - secretRef:
                name: juanie-secret
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
      terminationGracePeriodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: juanie-web
  namespace: juanie
  labels:
    app: juanie
    component: web
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
  selector:
    app: juanie
    component: web
EOF

# 部署 Juanie Worker
echo -e "${YELLOW}Deploying Juanie Worker...${NC}"
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: juanie-worker
  namespace: juanie
  labels:
    app: juanie
    component: worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: juanie
      component: worker
  template:
    metadata:
      labels:
        app: juanie
        component: worker
    spec:
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
          image: juanie:latest
          imagePullPolicy: Always
          command: ["bun", "run", "start:worker"]
          envFrom:
            - configMapRef:
                name: juanie-config
            - secretRef:
                name: juanie-secret
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            exec:
              command: ["sh", "-c", "ps aux | grep 'bun.*worker' | grep -v grep"]
            initialDelaySeconds: 30
            periodSeconds: 30
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
      terminationGracePeriodSeconds: 30
EOF

# 部署 Cilium Gateway
echo -e "${YELLOW}Deploying Cilium Gateway...${NC}"
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: juanie-gateway
  namespace: juanie
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: cilium
  addresses:
    - type: IPAddress
      value: 10.2.0.16
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: juanie-tls
            kind: Secret
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: juanie-route
  namespace: juanie
spec:
  parentRefs:
    - name: juanie-gateway
      sectionName: https
  hostnames:
    - juanie.art
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: juanie-web
          port: 80
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: juanie-redirect
  namespace: juanie
spec:
  parentRefs:
    - name: juanie-gateway
      sectionName: http
  hostnames:
    - juanie.art
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
EOF

# 等待部署就绪
echo -e "${YELLOW}Waiting for Juanie to be ready...${NC}"
kubectl wait --for=condition=available deployment/juanie-web -n juanie --timeout=180s
kubectl wait --for=condition=available deployment/juanie-worker -n juanie --timeout=60s

# 运行数据库迁移
echo -e "${YELLOW}Running database migration...${NC}"
kubectl exec -n juanie deployment/juanie-web -- bun run db:push || echo "Migration may have already run"

# 显示状态
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Deployment Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Pods:"
kubectl get pods -n juanie
echo ""
echo -e "Services:"
kubectl get svc -n juanie
echo ""
echo -e "Gateway:"
kubectl get gateway -n juanie
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Add DNS record: ${GREEN}juanie.art A 49.232.237.136${NC}"
echo -e "2. Wait for TLS certificate to be issued"
echo -e "3. Access https://juanie.art"
echo ""
echo -e "Check certificate status:"
echo -e "  kubectl get certificate -n juanie"
