# Bun + K8s mTLS 认证解决方案

## 问题描述

在使用 Bun 运行时连接 K3s 集群时，遇到 `401 Unauthorized` 错误。

**根本原因**: `@kubernetes/client-node` 库依赖 Node.js 的 TLS 实现，而 Bun 的 TLS 实现无法正确处理 K3s 的自签名证书和 mTLS 认证。

## 解决方案

创建了 `BunK8sClientService` - 使用 Bun 原生 fetch API + mTLS 的 K8s 客户端。

### 核心实现

**文件**: `packages/core/src/k8s/bun-k8s-client.service.ts`

```typescript
// 1. 使用 find-up 查找项目根目录（monorepo root）
async function resolveKubeconfigPath(kubeconfigPath: string): Promise<string> {
  if (kubeconfigPath.startsWith('~/')) {
    return resolve(homedir(), kubeconfigPath.slice(2))
  }
  if (kubeconfigPath.startsWith('/')) {
    return kubeconfigPath
  }
  
  // 使用 find-up 查找包含 turbo.json 的目录（monorepo root）
  const turboJsonPath = await findUp('turbo.json', { cwd: process.cwd() })
  if (!turboJsonPath) {
    throw new Error('Cannot find monorepo root (turbo.json not found)')
  }
  
  const projectRoot = dirname(turboJsonPath)
  return resolve(projectRoot, kubeconfigPath)
}

// 2. 解析 kubeconfig 提取证书
private parseKubeconfig(content: string): KubeconfigData {
  // 提取 server、certificate-authority-data、client-certificate-data、client-key-data
  return { server, ca, cert, key }
}

// 3. 使用 Bun 的 fetch API 配置 mTLS
private async request(method: string, path: string, body?: any) {
  const caData = Buffer.from(this.kubeconfig.ca, 'base64').toString('utf-8')
  const certData = Buffer.from(this.kubeconfig.cert, 'base64').toString('utf-8')
  const keyData = Buffer.from(this.kubeconfig.key, 'base64').toString('utf-8')

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    // @ts-expect-error - Bun 特定的 TLS 选项
    tls: {
      ca: caData,
      cert: certData,
      key: keyData,
      rejectUnauthorized: false, // 允许自签名证书
    },
  })
}
```

### 运行时检测

**文件**: `packages/core/src/k8s/k8s.module.ts`

```typescript
@Module({
  providers: [
    {
      provide: K8sClientService,
      useFactory: (config, eventEmitter, logger) => {
        const isBun = typeof Bun !== 'undefined'
        
        if (isBun) {
          return new BunK8sClientService(config, eventEmitter, logger)
        }
        
        return new K8sClientService(eventEmitter, logger)
      },
      inject: [ConfigService, EventEmitter2, PinoLogger],
    },
  ],
})
export class K8sModule {}
```

## 关键点

1. **路径解析**: 使用 `find-up` 库查找 monorepo root，支持相对路径配置
2. **正确的认证方式**: 使用 Client Certificate (mTLS)，而不是 Bearer Token
3. **证书解码**: 从 kubeconfig 的 base64 编码中提取 PEM 格式证书
4. **Bun 原生 API**: 利用 Bun fetch 的 `tls` 选项配置 mTLS
5. **接口兼容**: 实现与 K8sClientService 相同的接口，保持业务代码不变

## 配置方式

支持三种路径格式：

```bash
# 1. 相对路径（相对于 monorepo root）
KUBECONFIG=.kube/k3s-remote.yaml

# 2. 用户目录路径
KUBECONFIG=~/.kube/config

# 3. 绝对路径
KUBECONFIG=/path/to/kubeconfig
```

## 支持的操作

- ✅ Namespace 管理
- ✅ Pod 查询
- ✅ Deployment 管理
- ✅ Secret 管理
- ✅ Service 管理
- ✅ Custom Resources (Flux)
- ✅ Events 查询

## 验证

```bash
bun run dev:api
```

成功日志：
```
[BunK8sClientService] ✅ K8s 连接成功 (Bun Native Client with mTLS)
```

## 参考

- find-up: https://github.com/sindresorhus/find-up
- Bun fetch TLS 选项: https://bun.sh/docs/api/fetch
- K8s REST API: https://kubernetes.io/docs/reference/using-api/
- mTLS 认证: https://kubernetes.io/docs/reference/access-authn-authz/authentication/#x509-client-certs
