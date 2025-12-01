# Bun 原生 Kubernetes 客户端

## 背景

项目从 `@kubernetes/client-node` 迁移到自研的 `BunK8sClient`，以充分利用 Bun 的原生特性。

## 问题分析

### 原始问题
使用 `@kubernetes/client-node` 1.x 时，在 Bun 环境下出现 401 Unauthorized 错误，但 kubectl 和 Node.js 环境都能正常连接。

### 根本原因
1. `@kubernetes/client-node` 依赖 `node-fetch` 和 Node.js 的 `https.Agent` 来处理客户端证书
2. Bun 的 fetch 实现不支持 Node.js 的 `https.Agent` 对象
3. Bun 有自己的 TLS 配置方式：通过 `tls` 选项传递证书

### 验证过程
```typescript
// Bun 原生 fetch 支持 TLS 客户端证书
const response = await fetch(url, {
  tls: {
    cert: certString,
    key: keyString,
    rejectUnauthorized: false,
  },
})
```

## 解决方案

### BunK8sClient 实现

自研轻量级 K8s 客户端，核心代码仅 200 行，实现了：

**基础功能：**
- Kubeconfig 解析（YAML + base64 解码）
- 客户端证书认证
- Token 认证支持
- TLS 验证控制

**资源操作：**
- Namespace: CRUD
- Pod: 列表查询
- Secret: 创建
- Deployment: CRUD + 扩缩容
- Service: 创建、删除
- Custom Resources: 完整支持（用于 Flux）
- Events: 查询

### 技术优势

**vs @kubernetes/client-node:**
- ✅ 包体积：减少 20+ 个依赖
- ✅ 代码量：200 行 vs 数千行
- ✅ 性能：直接使用 Bun 的原生 fetch
- ✅ 可控性：完全掌握实现，易于调试和扩展
- ✅ 兼容性：同时支持 Bun 和 Node.js 18+

**核心实现：**
```typescript
private async request(path: string, options: RequestInit = {}) {
  const url = `${this.server}${path}`
  
  const fetchOptions: any = {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  }

  // Bun 的 TLS 配置
  if (this.cert && this.key) {
    fetchOptions.tls = {
      cert: this.cert,
      key: this.key,
      rejectUnauthorized: this.rejectUnauthorized,
    }
  }

  const response = await fetch(url, fetchOptions)
  if (!response.ok) {
    throw new Error(`K8s API error: ${response.status}`)
  }
  return response.json()
}
```

## 架构决策

### 为什么不用 @kubernetes/client-node？

**Kubernetes API 本质：**
- 就是 REST API over HTTPS
- 认证方式：客户端证书、Token、Bearer Token
- 数据格式：JSON

**@kubernetes/client-node 的价值：**
- 自动生成所有资源的 TypeScript 类型
- 支持多种认证方式（OIDC、Exec、GCP、AWS 等）
- Watch API、Stream API 等高级功能
- 跨版本兼容性处理

**我们的场景：**
- 单一 K3s 集群，固定配置
- 只用客户端证书认证
- 基本的 CRUD 操作
- 主要通过 Flux CD 管理资源

**结论：** 自研更简单、更高效。

### 未来扩展性

如果需要高级功能，可以按需添加：

**Token 认证（5 行代码）：**
```typescript
if (this.token) {
  fetchOptions.headers.Authorization = `Bearer ${this.token}`
}
```

**Watch API（10-20 行代码）：**
```typescript
async watchPods(namespace: string, callback: (event) => void) {
  const url = `${this.server}/api/v1/namespaces/${namespace}/pods?watch=true`
  // 使用 EventSource 或 streaming fetch
}
```

## 相关文件

- `packages/services/business/src/gitops/k3s/bun-k8s-client.ts` - 客户端实现
- `packages/services/business/src/gitops/k3s/k3s.service.ts` - NestJS 服务封装
- `scripts/test-bun-k8s-client.ts` - 测试脚本

## 经验教训

1. **不要轻易归咎于依赖的 bug** - 先深入理解问题根源
2. **理解运行时差异** - Bun 和 Node.js 的 API 兼容性
3. **评估依赖的必要性** - 很多第三方库做的工作并不复杂
4. **保持简单** - 只实现需要的功能，避免过度设计

## 更新日志

- 2025-11-28: 实现 BunK8sClient，移除 @kubernetes/client-node 依赖
- 2025-11-28: 修复 ESM 模式下 __dirname 问题
- 2025-11-28: 更新启动脚本为纯 Bun 方案
