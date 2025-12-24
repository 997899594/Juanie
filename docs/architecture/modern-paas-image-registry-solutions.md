# 现代化 PaaS 平台的镜像仓库解决方案

**日期**: 2024-12-24  
**问题**: K3s 集群镜像拉取 TLS 证书验证失败  
**目标**: 学习现代化平台的最佳实践

## 问题分析

### 我们遇到的问题

```
Failed to pull image "ghcr.io/997899594/11444a:latest": 
x509: certificate is valid for *.github.io, *.github.com, 
not ghcr.io
```

**根本原因**:
1. K3s 节点 CA 证书过期或不完整
2. 依赖外部公共镜像仓库（GitHub Container Registry）
3. 网络环境对 HTTPS 证书验证严格

## 现代化平台的解决方案

### 1. **Vercel / Netlify 方案：无容器化**

**核心思路**: 完全避免容器镜像问题

```
用户代码 → 构建服务器 → 静态文件/Serverless 函数 → CDN
```

**优势**:
- ✅ 无需镜像仓库
- ✅ 无需 K8s 集群
- ✅ 部署速度极快（秒级）
- ✅ 自动 HTTPS 证书

**适用场景**: 前端应用、Serverless API

**我们的应用**: ❌ 不适用（需要完整后端运行时）

---

### 2. **Railway / Render 方案：托管镜像仓库**

**核心思路**: 平台提供内置私有镜像仓库

```
用户代码 → 平台构建服务 → 平台私有镜像仓库 → 平台 K8s 集群
```

**架构**:
```yaml
# Railway 的实现方式
构建流程:
  1. 用户推送代码到 Git
  2. Railway 触发构建（Nixpacks/Dockerfile）
  3. 镜像推送到 Railway 内部镜像仓库
  4. 从内部仓库拉取镜像到运行时

镜像仓库:
  - 位置: 平台内网（与 K8s 集群同网络）
  - 认证: 自动注入 ImagePullSecret
  - 证书: 平台统一管理
  - 访问: 仅平台内部可访问
```

**优势**:
- ✅ 无需用户配置镜像仓库
- ✅ 无证书问题（内网通信）
- ✅ 拉取速度快（同数据中心）
- ✅ 安全性高（私有网络）

**实现要点**:
```typescript
// Railway 的镜像命名规范
const imageUrl = `registry.railway.internal/${projectId}:${deploymentId}`

// 自动注入的 ImagePullSecret
apiVersion: v1
kind: Secret
metadata:
  name: railway-registry
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-auth>
```

---

### 3. **Fly.io 方案：分布式镜像缓存**

**核心思路**: 全球分布式镜像缓存 + 智能路由

```
用户代码 → Fly.io 构建 → 全球镜像缓存节点 → 就近 K8s 集群
```

**架构**:
```yaml
镜像分发:
  - 主仓库: registry.fly.io
  - 边缘缓存: 每个区域的缓存节点
  - 智能路由: 自动选择最近的缓存节点

证书管理:
  - 统一 CA: Fly.io 自签名 CA
  - 自动信任: 所有节点预装 Fly.io CA 证书
  - 内网通信: 使用 WireGuard VPN
```

**优势**:
- ✅ 全球加速（边缘缓存）
- ✅ 无证书问题（统一 CA）
- ✅ 高可用（多节点冗余）

---

### 4. **Kubernetes 原生方案：Harbor + Cert-Manager**

**核心思路**: 企业级镜像仓库 + 自动证书管理

```
用户代码 → CI/CD → Harbor 镜像仓库 → K8s 集群
                      ↓
                  Cert-Manager（自动续期证书）
```

**架构**:
```yaml
# Harbor 部署
apiVersion: v1
kind: Service
metadata:
  name: harbor-registry
spec:
  type: ClusterIP
  ports:
    - port: 443
      targetPort: 8443

---
# Cert-Manager 自动证书
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: harbor-tls
spec:
  secretName: harbor-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - registry.yourdomain.com
```

**优势**:
- ✅ 企业级功能（漏洞扫描、签名验证）
- ✅ 自动证书续期
- ✅ 完全自主可控
- ✅ 支持多租户

**劣势**:
- ❌ 部署复杂
- ❌ 需要维护
- ❌ 资源占用高

---

### 5. **云原生方案：云厂商托管镜像仓库**

**核心思路**: 使用云厂商的容器镜像服务

```
用户代码 → CI/CD → 云镜像仓库 → K8s 集群
                    ↓
                  (ACR/ECR/GCR/阿里云 ACR)
```

**示例 - 阿里云 ACR**:
```yaml
# 镜像地址
image: registry.cn-hangzhou.aliyuncs.com/namespace/app:tag

# ImagePullSecret（自动创建）
apiVersion: v1
kind: Secret
metadata:
  name: aliyun-registry-secret
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-config>
```

**优势**:
- ✅ 零运维（云厂商管理）
- ✅ 高可用（SLA 保证）
- ✅ 与云服务集成（VPC、IAM）
- ✅ 国内访问快（CDN 加速）

**成本**:
- 阿里云 ACR: ¥0.001/GB/天（存储）+ ¥0.5/GB（流量）
- 腾讯云 TCR: 类似定价
- AWS ECR: $0.10/GB/月

---

## 推荐方案对比

| 方案 | 复杂度 | 成本 | 性能 | 适用场景 |
|------|--------|------|------|----------|
| **内置镜像仓库** | ⭐⭐⭐⭐⭐ | 高 | ⭐⭐⭐⭐⭐ | 多租户 PaaS 平台 |
| **Harbor + Cert-Manager** | ⭐⭐⭐ | 中 | ⭐⭐⭐⭐ | 企业私有云 |
| **云厂商镜像仓库** | ⭐⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ | 中小型项目 |
| **分布式缓存** | ⭐⭐ | 高 | ⭐⭐⭐⭐⭐ | 全球化部署 |

## 我们的最佳实践方案

### 短期方案（立即可用）：阿里云 ACR

**为什么选择阿里云 ACR**:
1. ✅ 国内访问速度快
2. ✅ 与腾讯云 K3s 同区域（低延迟）
3. ✅ 零配置（无需管理证书）
4. ✅ 成本低（按量付费）
5. ✅ 支持私有镜像（多租户隔离）

**实施步骤**:

```typescript
// 1. 修改 GitHub Actions 推送到阿里云 ACR
// .github/workflows/build-project-image.yml

- name: Login to Aliyun ACR
  uses: docker/login-action@v3
  with:
    registry: registry.cn-hangzhou.aliyuncs.com
    username: ${{ secrets.ALIYUN_ACR_USERNAME }}
    password: ${{ secrets.ALIYUN_ACR_PASSWORD }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: registry.cn-hangzhou.aliyuncs.com/juanie/${{ env.PROJECT_NAME }}:${{ github.sha }}
```

```typescript
// 2. 更新 K8s Deployment 镜像地址
// templates/nextjs-15-app/k8s/base/deployment.yaml

spec:
  containers:
    - name: app
      image: registry.cn-hangzhou.aliyuncs.com/juanie/<%= projectName %>:latest
      
  imagePullSecrets:
    - name: aliyun-acr-secret
```

```typescript
// 3. 自动创建 ImagePullSecret
// packages/services/business/src/gitops/credentials/credentials.service.ts

async createImagePullSecret(namespace: string, userId: string) {
  const dockerConfig = {
    auths: {
      'registry.cn-hangzhou.aliyuncs.com': {
        username: process.env.ALIYUN_ACR_USERNAME,
        password: process.env.ALIYUN_ACR_PASSWORD,
        auth: Buffer.from(
          `${process.env.ALIYUN_ACR_USERNAME}:${process.env.ALIYUN_ACR_PASSWORD}`
        ).toString('base64'),
      },
    },
  }

  await this.k3sService.createSecret(namespace, {
    metadata: { name: 'aliyun-acr-secret' },
    type: 'kubernetes.io/dockerconfigjson',
    data: {
      '.dockerconfigjson': Buffer.from(JSON.stringify(dockerConfig)).toString('base64'),
    },
  })
}
```

**成本估算**:
- 存储: 100 个项目 × 500MB × ¥0.001/GB/天 = ¥1.5/天 = ¥45/月
- 流量: 100 次部署 × 500MB × ¥0.5/GB = ¥25/月
- **总计**: ~¥70/月（约 $10/月）

---

### 中期方案（3-6 个月）：自建 Harbor

**适用场景**: 项目数量 > 100，需要企业级功能

**优势**:
- 漏洞扫描（Trivy 集成）
- 镜像签名（Notary）
- 多租户隔离
- 审计日志
- Webhook 通知

**部署方式**:
```bash
# 使用 Helm 部署 Harbor
helm repo add harbor https://helm.goharbor.io
helm install harbor harbor/harbor \
  --set expose.type=ingress \
  --set expose.ingress.hosts.core=registry.yourdomain.com \
  --set externalURL=https://registry.yourdomain.com \
  --set persistence.enabled=true
```

---

### 长期方案（1 年+）：内置镜像仓库

**适用场景**: 成为真正的 PaaS 平台，用户数 > 1000

**架构设计**:
```typescript
// 内置镜像仓库服务
@Injectable()
export class InternalRegistryService {
  // 为每个项目创建独立的镜像仓库命名空间
  async createProjectRegistry(projectId: string) {
    const namespace = `project-${projectId}`
    
    // 1. 创建 Harbor 项目
    await this.harborClient.createProject({
      project_name: namespace,
      public: false,
    })
    
    // 2. 创建 Robot Account（自动化推送）
    const robot = await this.harborClient.createRobotAccount({
      name: `robot-${projectId}`,
      permissions: ['push', 'pull'],
    })
    
    // 3. 返回镜像地址和凭证
    return {
      registry: `registry.internal.juanie.dev/${namespace}`,
      username: robot.name,
      password: robot.secret,
    }
  }
}
```

**成本**:
- 服务器: ¥500/月（4C8G）
- 存储: ¥200/月（1TB SSD）
- 带宽: ¥100/月（100Mbps）
- **总计**: ¥800/月（约 $110/月）

---

## 立即行动计划

### 第一步：切换到阿里云 ACR（1 小时）

1. 注册阿里云账号，开通容器镜像服务
2. 创建命名空间 `juanie`
3. 获取访问凭证
4. 更新环境变量
5. 修改 GitHub Actions 工作流
6. 更新 K8s 模板

### 第二步：自动化 ImagePullSecret 创建（2 小时）

1. 修改 `CredentialsService`
2. 在项目初始化时自动创建 Secret
3. 测试多租户隔离

### 第三步：验证和监控（1 小时）

1. 部署测试项目
2. 验证镜像拉取成功
3. 配置镜像仓库监控

---

## 参考资料

- [Railway 架构设计](https://blog.railway.app/p/how-we-built-railway)
- [Fly.io 镜像分发](https://fly.io/docs/reference/builders/)
- [Harbor 官方文档](https://goharbor.io/docs/)
- [阿里云 ACR 文档](https://help.aliyun.com/product/60716.html)
- [Kubernetes ImagePullSecrets](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)

## 总结

现代化平台的核心思路：
1. **用户无感知** - 自动处理镜像仓库和证书
2. **平台托管** - 统一管理，降低用户复杂度
3. **性能优先** - 内网/边缘缓存，极速拉取
4. **安全第一** - 私有仓库，多租户隔离

我们应该：
- ✅ 短期：使用阿里云 ACR（快速解决问题）
- ✅ 中期：评估 Harbor（企业级功能）
- ✅ 长期：构建内置镜像仓库（真正的 PaaS）
