import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { findUp } from 'find-up'
import { PinoLogger } from 'nestjs-pino'
import { SystemEvents } from '../events'

interface KubeconfigData {
  server: string
  ca: string
  cert: string
  key: string
}

/**
 * 解析 kubeconfig 路径
 * 使用 find-up 查找项目根目录（monorepo root）
 */
async function resolveKubeconfigPath(kubeconfigPath: string): Promise<string> {
  // 处理 ~ 开头的路径
  if (kubeconfigPath.startsWith('~/')) {
    return resolve(homedir(), kubeconfigPath.slice(2))
  }

  // 处理绝对路径
  if (kubeconfigPath.startsWith('/')) {
    return kubeconfigPath
  }

  // 处理相对路径（相对于项目根目录）
  // 使用 find-up 查找包含 turbo.json 的目录（monorepo root）
  const turboJsonPath = await findUp('turbo.json', { cwd: process.cwd() })
  if (!turboJsonPath) {
    throw new Error('Cannot find monorepo root (turbo.json not found)')
  }

  const projectRoot = dirname(turboJsonPath)
  return resolve(projectRoot, kubeconfigPath)
}

/**
 * Bun 原生 K8s 客户端
 *
 * 使用 Bun 的 fetch API + mTLS 直接调用 K8s REST API
 * 绕过 @kubernetes/client-node 的 TLS 问题
 *
 * 认证方式: Client Certificate (mTLS)
 *
 * 配置方式:
 * 1. 设置 KUBECONFIG 环境变量（支持绝对路径、~、相对路径）
 * 2. 使用默认路径 ~/.kube/config
 */
@Injectable()
export class BunK8sClientService implements OnModuleInit {
  private kubeconfig!: KubeconfigData
  private isConnected = false

  constructor(
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BunK8sClientService.name)
  }

  async onModuleInit() {
    await this.connect()
  }

  private async connect() {
    try {
      // 读取 KUBECONFIG 环境变量，默认使用 ~/.kube/config
      const kubeconfigPath = this.config.get<string>('KUBECONFIG') || '~/.kube/config'

      // 解析路径（使用 find-up 查找项目根目录）
      const resolvedPath = await resolveKubeconfigPath(kubeconfigPath)

      // 读取并解析 kubeconfig
      const kubeconfigContent = readFileSync(resolvedPath, 'utf-8')
      this.kubeconfig = this.parseKubeconfig(kubeconfigContent)

      // 测试连接
      await this.request('GET', '/api/v1/namespaces')

      this.isConnected = true
      this.logger.info('✅ K8s 连接成功 (Bun Native Client with mTLS)')

      this.eventEmitter.emit(SystemEvents.K8S_CONNECTED, {
        timestamp: new Date(),
      })
    } catch (error: any) {
      this.isConnected = false
      this.logger.warn({ error: error.message }, '⚠️ K8s 连接失败')

      this.eventEmitter.emit(SystemEvents.K8S_CONNECTION_FAILED, {
        error: error.message,
        timestamp: new Date(),
      })
    }
  }

  private parseKubeconfig(content: string): KubeconfigData {
    const lines = content.split('\n')
    let server = ''
    let ca = ''
    let cert = ''
    let key = ''

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('server:')) {
        const parts = trimmed.split('server:')
        if (parts[1]) {
          server = parts[1].trim()
        }
      } else if (trimmed.startsWith('certificate-authority-data:')) {
        const parts = trimmed.split('certificate-authority-data:')
        if (parts[1]) {
          ca = parts[1].trim()
        }
      } else if (trimmed.startsWith('client-certificate-data:')) {
        const parts = trimmed.split('client-certificate-data:')
        if (parts[1]) {
          cert = parts[1].trim()
        }
      } else if (trimmed.startsWith('client-key-data:')) {
        const parts = trimmed.split('client-key-data:')
        if (parts[1]) {
          key = parts[1].trim()
        }
      }
    }

    if (!server || !ca || !cert || !key) {
      throw new Error('Invalid kubeconfig: missing required fields')
    }

    return { server, ca, cert, key }
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    if (!this.kubeconfig) {
      throw new Error('K8s not connected')
    }

    const url = `${this.kubeconfig.server}${path}`

    // Decode base64 certificates
    const caData = Buffer.from(this.kubeconfig.ca, 'base64').toString('utf-8')
    const certData = Buffer.from(this.kubeconfig.cert, 'base64').toString('utf-8')
    const keyData = Buffer.from(this.kubeconfig.key, 'base64').toString('utf-8')

    // Bun 的 fetch 支持 mTLS
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      // @ts-expect-error - Bun 特定的 TLS 选项
      tls: {
        ca: caData,
        cert: certData,
        key: keyData,
        rejectUnauthorized: false, // 允许自签名证书
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`K8s API error: ${response.status} ${text}`)
    }

    return await response.json()
  }

  isK8sConnected(): boolean {
    return this.isConnected
  }

  async verifyAuthentication(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConnected) {
      return { valid: false, error: 'K8s not connected' }
    }

    try {
      await this.listNamespaces()
      return { valid: true }
    } catch (error: any) {
      return { valid: false, error: error.message || 'Authentication failed' }
    }
  }

  // ==================== Namespace 操作 ====================

  async listNamespaces() {
    if (!this.isConnected) return []

    const result = await this.request('GET', '/api/v1/namespaces')
    return result.items || []
  }

  async createNamespace(name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    return await this.request('POST', '/api/v1/namespaces', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name },
    })
  }

  async deleteNamespace(name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request('DELETE', `/api/v1/namespaces/${name}`)
  }

  async namespaceExists(name: string): Promise<boolean> {
    if (!this.isConnected) return false

    try {
      await this.request('GET', `/api/v1/namespaces/${name}`)
      return true
    } catch {
      return false
    }
  }

  // ==================== Pod 操作 ====================

  async getPods(namespace: string, labelSelector?: string) {
    if (!this.isConnected) return []

    let path = `/api/v1/namespaces/${namespace}/pods`
    if (labelSelector) {
      path += `?labelSelector=${encodeURIComponent(labelSelector)}`
    }

    const result = await this.request('GET', path)
    return result.items || []
  }

  // ==================== Secret 操作 ====================

  async createSecret(
    namespace: string,
    name: string,
    data: Record<string, string>,
    type = 'Opaque',
  ) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    // Base64 编码数据
    const encodedData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64')
    }

    return await this.request('POST', `/api/v1/namespaces/${namespace}/secrets`, {
      apiVersion: 'v1',
      kind: 'Secret',
      type,
      metadata: { name, namespace },
      data: encodedData,
    })
  }

  async deleteSecret(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request('DELETE', `/api/v1/namespaces/${namespace}/secrets/${name}`)
  }

  async updateSecret(namespace: string, name: string, data: Record<string, string>) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    // Base64 编码数据
    const encodedData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64')
    }

    return await this.request('PUT', `/api/v1/namespaces/${namespace}/secrets/${name}`, {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name, namespace },
      data: encodedData,
    })
  }

  // ==================== Deployment 操作 ====================

  async listDeployments(namespace: string) {
    if (!this.isConnected) return []

    const result = await this.request('GET', `/apis/apps/v1/namespaces/${namespace}/deployments`)
    return result.items || []
  }

  async createDeployment(namespace: string, deployment: any) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request(
      'POST',
      `/apis/apps/v1/namespaces/${namespace}/deployments`,
      deployment,
    )
  }

  async getDeployment(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request('GET', `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`)
  }

  async deleteDeployment(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request('DELETE', `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`)
  }

  async updateDeployment(namespace: string, name: string, deployment: any) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request(
      'PUT',
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      deployment,
    )
  }

  async scaleDeployment(namespace: string, name: string, replicas: number) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    const deployment = await this.getDeployment(namespace, name)
    if (deployment.spec) {
      deployment.spec.replicas = replicas
      return await this.updateDeployment(namespace, name, deployment)
    }

    throw new Error('Deployment spec not found')
  }

  // ==================== Service 操作 ====================

  async createService(namespace: string, service: any) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request('POST', `/api/v1/namespaces/${namespace}/services`, service)
  }

  async deleteService(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.request('DELETE', `/api/v1/namespaces/${namespace}/services/${name}`)
  }

  // ==================== Custom Resources (Flux) ====================

  async createNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
    body: any
  }) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    const path = `/apis/${options.group}/${options.version}/namespaces/${options.namespace}/${options.plural}`

    return await this.request('POST', path, options.body)
  }

  async deleteNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
    name: string
  }) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    const path = `/apis/${options.group}/${options.version}/namespaces/${options.namespace}/${options.plural}/${options.name}`

    return await this.request('DELETE', path)
  }

  async patchNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
    name: string
    body: any
  }) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    const path = `/apis/${options.group}/${options.version}/namespaces/${options.namespace}/${options.plural}/${options.name}`

    return await this.request('PATCH', path, options.body)
  }

  async getNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
    name: string
  }) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    const path = `/apis/${options.group}/${options.version}/namespaces/${options.namespace}/${options.plural}/${options.name}`

    return await this.request('GET', path)
  }

  async listNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
  }) {
    if (!this.isConnected) return []

    const path = `/apis/${options.group}/${options.version}/namespaces/${options.namespace}/${options.plural}`

    const result = await this.request('GET', path)
    return result.items || []
  }

  /**
   * 获取 Custom Objects API（兼容接口）
   * 返回一个对象，提供与 @kubernetes/client-node 兼容的方法
   */
  getCustomObjectsApi() {
    return {
      createNamespacedCustomObject: this.createNamespacedCustomObject.bind(this),
      deleteNamespacedCustomObject: this.deleteNamespacedCustomObject.bind(this),
      patchNamespacedCustomObject: this.patchNamespacedCustomObject.bind(this),
      getNamespacedCustomObject: this.getNamespacedCustomObject.bind(this),
      listNamespacedCustomObject: this.listNamespacedCustomObject.bind(this),
    }
  }

  // ==================== Events ====================

  async getEvents(namespace: string) {
    if (!this.isConnected) return []

    const result = await this.request('GET', `/api/v1/namespaces/${namespace}/events`)
    return result.items || []
  }

  // ==================== Flux 操作 ====================

  /**
   * 触发 Kustomization 立即 reconcile
   * 通过添加 annotation 强制 Flux 立即同步
   */
  async reconcileKustomization(name: string, namespace: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('K8s is not connected')
    }

    try {
      await this.patchNamespacedCustomObject({
        group: 'kustomize.toolkit.fluxcd.io',
        version: 'v1',
        namespace,
        plural: 'kustomizations',
        name,
        body: {
          metadata: {
            annotations: {
              'reconcile.fluxcd.io/requestedAt': new Date().toISOString(),
            },
          },
        },
      })

      this.logger.info(`✅ Triggered reconcile for Kustomization ${name} in ${namespace}`)
    } catch (error: any) {
      this.logger.error(`Failed to reconcile Kustomization ${name}:`, error)
      throw new Error(`Failed to trigger reconcile: ${error.message}`)
    }
  }
}
