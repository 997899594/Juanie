# K3s 轻量级 Kubernetes 安装指南

## 什么是 K3s？

K3s 是 Rancher 开发的轻量级 Kubernetes 发行版，专为：
- 边缘计算
- IoT 设备
- CI/CD 环境
- 开发环境

**特点**：
- 📦 单个二进制文件（< 100MB）
- 🚀 快速启动（< 30秒）
- 💾 低内存占用（512MB 最小）
- 🔧 易于安装和维护

## 安装 K3s

### macOS 安装

```bash
# 使用 Homebrew 安装
brew install k3d

# 或者使用 Rancher Desktop（推荐）
brew install --cask rancher-desktop

# 或者使用 Colima + K3s
brew install colima
colima start --kubernetes
```

### Linux 安装

```bash
# 一键安装 K3s
curl -sfL https://get.k3s.io | sh -

# 检查状态
sudo systemctl status k3s

# 获取 kubeconfig
sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config

# 设置权限
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
```

### 使用 K3d（推荐用于开发）

K3d 是在 Docker 中运行 K3s 的工具：

```bash
# 安装 k3d
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# 创建集群
k3d cluster create ai-devops \
  --agents 2 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer"

# 验证
kubectl cluster-info
kubectl get nodes
```

## 配置 K3s 集群

### 1. 安装 kubectl

```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

### 2. 安装 Helm

```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 3. 配置命名空间

```bash
# 创建命名空间
kubectl create namespace ai-devops-dev
kubectl create namespace ai-devops-prod

# 设置默认命名空间
kubectl config set-context --current --namespace=ai-devops-dev
```

## 部署应用到 K3s

### 1. 创建 Kubernetes 配置

创建 `k8s/` 目录结构：

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── postgres.yaml
│   ├── dragonfly.yaml
│   ├── api-gateway.yaml
│   └── web.yaml
├── dev/
│   └── kustomization.yaml
└── prod/
    └── kustomization.yaml
```

### 2. PostgreSQL 部署

```yaml
# k8s/base/postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:17-alpine
        env:
        - name: POSTGRES_DB
          value: "devops"
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### 3. Dragonfly 部署

```yaml
# k8s/base/dragonfly.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dragonfly
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dragonfly
  template:
    metadata:
      labels:
        app: dragonfly
    spec:
      containers:
      - name: dragonfly
        image: docker.dragonflydb.io/dragonflydb/dragonfly
        ports:
        - containerPort: 6379
        resources:
          limits:
            memory: "1Gi"
            cpu: "1"
---
apiVersion: v1
kind: Service
metadata:
  name: dragonfly
spec:
  selector:
    app: dragonfly
  ports:
  - port: 6379
    targetPort: 6379
```

### 4. API Gateway 部署

```yaml
# k8s/base/api-gateway.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: your-registry/ai-devops-api:latest
        env:
        - name: DATABASE_URL
          value: "postgresql://postgres:password@postgres:5432/devops"
        - name: REDIS_URL
          value: "redis://dragonfly:6379"
        - name: NODE_ENV
          value: "production"
        ports:
        - containerPort: 3000
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  selector:
    app: api-gateway
  ports:
  - port: 3000
    targetPort: 3000
```

### 5. Web 前端部署

```yaml
# k8s/base/web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: your-registry/ai-devops-web:latest
        ports:
        - containerPort: 80
        resources:
          limits:
            memory: "256Mi"
            cpu: "250m"
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
spec:
  rules:
  - host: ai-devops.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 3000
```

## 部署命令

```bash
# 创建 Secret
kubectl create secret generic postgres-secret \
  --from-literal=password=your-password

# 部署所有服务
kubectl apply -f k8s/base/

# 查看部署状态
kubectl get pods
kubectl get services
kubectl get ingress

# 查看日志
kubectl logs -f deployment/api-gateway
kubectl logs -f deployment/web
```

## 使用 Helm Chart（推荐）

### 1. 创建 Helm Chart

```bash
# 创建 Chart
helm create ai-devops

# 目录结构
ai-devops/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── configmap.yaml
```

### 2. 安装 Chart

```bash
# 安装
helm install ai-devops ./ai-devops \
  --namespace ai-devops-dev \
  --create-namespace

# 升级
helm upgrade ai-devops ./ai-devops

# 卸载
helm uninstall ai-devops
```

## 监控和日志

### 1. 安装 Prometheus + Grafana

```bash
# 添加 Helm 仓库
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 安装 kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# 访问 Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# 访问: http://localhost:3000
# 用户名: admin
# 密码: prom-operator
```

### 2. 查看日志

```bash
# 查看 Pod 日志
kubectl logs -f <pod-name>

# 查看所有 Pod 日志
kubectl logs -f -l app=api-gateway

# 查看前 100 行
kubectl logs --tail=100 <pod-name>
```

## 常用命令

```bash
# 查看资源
kubectl get all
kubectl get pods -o wide
kubectl get services
kubectl get deployments

# 描述资源
kubectl describe pod <pod-name>
kubectl describe service <service-name>

# 进入容器
kubectl exec -it <pod-name> -- /bin/sh

# 端口转发
kubectl port-forward service/api-gateway 3000:3000

# 扩缩容
kubectl scale deployment api-gateway --replicas=3

# 滚动更新
kubectl set image deployment/api-gateway api-gateway=new-image:tag

# 回滚
kubectl rollout undo deployment/api-gateway

# 删除资源
kubectl delete pod <pod-name>
kubectl delete deployment <deployment-name>
```

## 清理

```bash
# 删除集群（k3d）
k3d cluster delete ai-devops

# 卸载 K3s（Linux）
/usr/local/bin/k3s-uninstall.sh

# 停止 Colima
colima stop
```

## 资源要求

### 最小配置
- CPU: 2 核心
- 内存: 2GB
- 磁盘: 20GB

### 推荐配置
- CPU: 4 核心
- 内存: 8GB
- 磁盘: 50GB

## 下一步

1. **CI/CD 集成**: 配置 GitLab CI 自动部署到 K3s
2. **自动扩缩容**: 配置 HPA（Horizontal Pod Autoscaler）
3. **服务网格**: 安装 Istio 或 Linkerd
4. **备份恢复**: 配置 Velero 进行备份

## 参考资源

- [K3s 官方文档](https://docs.k3s.io/)
- [K3d 文档](https://k3d.io/)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Helm 文档](https://helm.sh/docs/)

---

**提示**: K3s 适合生产环境和开发环境。对于本地开发，推荐使用 k3d 或 Rancher Desktop。
