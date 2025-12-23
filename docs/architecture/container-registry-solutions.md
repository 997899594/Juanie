# 容器镜像仓库方案对比 - 2025 现代化选择

## 问题背景

当前配置使用 `registry.example.com`（占位符），需要选择真实的镜像仓库方案。

## 现代化方案对比

### 方案 1: GitHub Container Registry (ghcr.io) ⭐⭐⭐⭐⭐

**推荐指数**: 最高

**优势**:
- ✅ **完全免费** - 公开镜像无限存储
- ✅ **与 GitHub 深度集成** - 同一个 token
- ✅ **自动权限管理** - 继承仓库权限
- ✅ **GitHub Actions 原生支持** - 无需额外配置
- ✅ **全球 CDN** - 拉取速度快
- ✅ **OCI 标准** - 支持多架构镜像

**配置**:
```yaml
# GitHub Actions
- name: Login to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: ghcr.io/${{ github.repository }}:latest
```

**K8s 配置**:
```yaml
image: ghcr.io/997899594/011:latest
imagePullSecrets:
- name: ghcr-secret
```

**成本**: $0

**适用场景**:
- 使用 GitHub 托管代码
- 需要私有镜像
- 多项目托管平台

---

### 方案 2: Docker Hub ⭐⭐⭐⭐

**推荐指数**: 高

**优势**:
- ✅ **最流行** - 生态最完善
- ✅ **免费层** - 1 个私有仓库 + 无限公开
- ✅ **全球镜像** - 拉取速度快
- ✅ **简单易用** - 配置最简单

**限制**:
- ❌ **拉取限制** - 匿名 100次/6小时，登录 200次/6小时
- ❌ **私有仓库限制** - 免费只有 1 个
- ❌ **付费贵** - $5/月 per 仓库

**配置**:
```yaml
# GitHub Actions
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: username/project:latest
```

**成本**: 
- 免费: 1 个私有仓库
- Pro: $5/月 (5 个私有仓库)

**适用场景**:
- 公开项目
- 单个私有项目
- 需要最大兼容性

---

### 方案 3: 自建 Harbor ⭐⭐⭐

**推荐指数**: 中等

**优势**:
- ✅ **完全控制** - 数据在自己手里
- ✅ **企业级功能** - 漏洞扫描、签名、复制
- ✅ **无限制** - 无拉取限制
- ✅ **多租户** - 支持多项目隔离

**劣势**:
- ❌ **运维成本高** - 需要维护
- ❌ **资源占用** - 至少需要 4GB 内存
- ❌ **配置复杂** - 需要 HTTPS、存储

**资源需求**:
```yaml
# Harbor 最小配置
CPU: 2 核
内存: 4GB
存储: 50GB+
```

**成本**: 
- 服务器: $20-40/月
- 运维时间: 2-4 小时/月

**适用场景**:
- 企业内部使用
- 需要合规审计
- 有专职运维

---

### 方案 4: K3s 内置 Registry ⭐⭐⭐⭐

**推荐指数**: 高（适合你的场景）

**优势**:
- ✅ **零成本** - 使用现有集群
- ✅ **本地拉取** - 速度最快
- ✅ **简单** - 一条命令启动
- ✅ **无限制** - 无拉取限制

**劣势**:
- ❌ **单点故障** - 集群挂了镜像也没了
- ❌ **无 UI** - 只能命令行
- ❌ **无高级功能** - 无扫描、签名

**配置**:
```bash
# 1. 启动 Registry
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: registry
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: registry
  template:
    metadata:
      labels:
        app: registry
    spec:
      containers:
      - name: registry
        image: registry:2
        ports:
        - containerPort: 5000
        volumeMounts:
        - name: registry-data
          mountPath: /var/lib/registry
      volumes:
      - name: registry-data
        hostPath:
          path: /var/lib/registry
---
apiVersion: v1
kind: Service
metadata:
  name: registry
  namespace: kube-system
spec:
  selector:
    app: registry
  ports:
  - port: 5000
    targetPort: 5000
  type: NodePort
EOF

# 2. 配置 K3s 使用本地 Registry
# /etc/rancher/k3s/registries.yaml
mirrors:
  "registry.local:5000":
    endpoint:
      - "http://registry.kube-system.svc.cluster.local:5000"
```

**成本**: $0

**适用场景**:
- 测试环境
- 小规模部署
- 预算有限

---

### 方案 5: Cloudflare R2 + Workers ⭐⭐⭐⭐⭐

**推荐指数**: 最高（最现代）

**优势**:
- ✅ **极低成本** - $0.015/GB 存储
- ✅ **零出口费用** - 拉取免费
- ✅ **全球 CDN** - 速度极快
- ✅ **OCI 兼容** - 标准协议

**配置**:
```javascript
// Cloudflare Worker 实现 OCI Registry
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理 OCI Registry API
    if (path.startsWith('/v2/')) {
      // 从 R2 读取镜像层
      const object = await env.R2.get(path);
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/vnd.docker.distribution.manifest.v2+json'
        }
      });
    }
  }
}
```

**成本**:
- 存储: $0.015/GB/月
- 100GB 镜像 = $1.5/月
- 拉取: $0

**适用场景**:
- 大量项目
- 全球分布
- 成本敏感

---

## 推荐方案

### 短期方案（立即可用）: GitHub Container Registry

**理由**:
1. 你已经在用 GitHub
2. 完全免费
3. 配置最简单
4. 与现有流程无缝集成

**实施步骤**:

1. **配置环境变量**:
```bash
# .env
REGISTRY_URL=ghcr.io/997899594
```

2. **添加 GitHub Actions**:
```yaml
# .github/workflows/build.yml
name: Build and Push Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

3. **配置 K8s ImagePullSecret**:
```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=997899594 \
  --docker-password=$GITHUB_TOKEN \
  -n project-xxx
```

---

### 中期方案（1-2周）: K3s 内置 Registry

**理由**:
1. 零成本
2. 本地拉取最快
3. 适合测试环境

**实施步骤**:

1. **部署 Registry**:
```bash
kubectl apply -f infra/registry/registry.yaml
```

2. **配置 K3s**:
```yaml
# /etc/rancher/k3s/registries.yaml
mirrors:
  "registry.local:5000":
    endpoint:
      - "http://registry.kube-system.svc.cluster.local:5000"
```

3. **重启 K3s**:
```bash
systemctl restart k3s
```

---

### 长期方案（1-2月）: Cloudflare R2 + Workers

**理由**:
1. 成本最低（$1-2/月）
2. 性能最好（全球 CDN）
3. 无限扩展

**实施步骤**:

1. **创建 R2 Bucket**
2. **部署 Worker**
3. **配置 DNS**
4. **更新镜像地址**

---

## 成本对比

| 方案 | 100个项目 | 1000个项目 | 优势 |
|------|----------|-----------|------|
| GitHub Container Registry | $0 | $0 | 免费无限 |
| Docker Hub | $500/月 | $5000/月 | 太贵 ❌ |
| Harbor 自建 | $40/月 | $100/月 | 运维成本高 |
| K3s Registry | $0 | $0 | 本地最快 |
| Cloudflare R2 | $1.5/月 | $15/月 | 最便宜 ✅ |

## 最终建议

**立即执行**: GitHub Container Registry
- 配置 `REGISTRY_URL=ghcr.io/997899594`
- 添加 GitHub Actions 构建镜像
- 配置 ImagePullSecret

**效果**:
- 0 成本
- 5 分钟配置完成
- 支持无限项目

要我开始配置吗？
