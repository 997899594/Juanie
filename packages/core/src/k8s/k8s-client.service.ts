import * as k8s from '@kubernetes/client-node'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PinoLogger } from 'nestjs-pino'
import { SystemEvents } from '../events'

/**
 * K8s 客户端服务
 *
 * 使用官方 @kubernetes/client-node 库
 * 提供 K8s 集群操作的统一接口
 */
@Injectable()
export class K8sClientService implements OnModuleInit {
  private kc: k8s.KubeConfig
  private k8sApi!: k8s.CoreV1Api
  private appsApi!: k8s.AppsV1Api
  private customObjectsApi!: k8s.CustomObjectsApi
  private isConnected = false

  constructor(
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(K8sClientService.name)
    this.kc = new k8s.KubeConfig()
  }

  async onModuleInit() {
    await this.connect()
  }

  private async connect() {
    try {
      // 加载 kubeconfig
      const kubeconfigPath = this.config.get<string>('KUBECONFIG')

      if (kubeconfigPath) {
        this.kc.loadFromFile(kubeconfigPath)
      } else {
        // 尝试默认位置或集群内配置
        try {
          this.kc.loadFromDefault()
        } catch {
          this.kc.loadFromCluster()
        }
      }

      // 初始化 API 客户端
      this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api)
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
      this.customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi)

      // 测试连接
      await this.k8sApi.listNamespace()

      this.isConnected = true
      this.logger.info('✅ K8s 连接成功')

      this.eventEmitter.emit(SystemEvents.K8S_CONNECTED, {
        timestamp: new Date(),
      })
    } catch (error: any) {
      this.isConnected = false
      this.logger.warn(`⚠️ K8s 连接失败: ${error.message}`)

      this.eventEmitter.emit(SystemEvents.K8S_CONNECTION_FAILED, {
        error: error.message,
        timestamp: new Date(),
      })
    }
  }

  isK8sConnected(): boolean {
    return this.isConnected
  }

  async verifyAuthentication(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConnected) {
      return { valid: false, error: 'K8s not connected' }
    }

    try {
      await this.k8sApi.listNamespace()
      return { valid: true }
    } catch (error: any) {
      return { valid: false, error: error.message || 'Authentication failed' }
    }
  }

  // ==================== Namespace 操作 ====================

  async createNamespace(name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    const namespace: k8s.V1Namespace = {
      metadata: { name },
    }

    return await this.k8sApi.createNamespace({ body: namespace })
  }

  async listNamespaces() {
    if (!this.isConnected) return []

    const response = await this.k8sApi.listNamespace()
    return response.items
  }

  async deleteNamespace(name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.k8sApi.deleteNamespace({ name })
  }

  async namespaceExists(name: string): Promise<boolean> {
    if (!this.isConnected) return false

    try {
      await this.k8sApi.readNamespace({ name })
      return true
    } catch {
      return false
    }
  }

  // ==================== Pod 操作 ====================

  async getPods(namespace: string, labelSelector?: string) {
    if (!this.isConnected) return []

    const response = await this.k8sApi.listNamespacedPod({
      namespace,
      labelSelector,
    })

    return response.items
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

    const secret: k8s.V1Secret = {
      metadata: { name, namespace },
      type,
      data: encodedData,
    }

    return await this.k8sApi.createNamespacedSecret({ namespace, body: secret })
  }

  async deleteSecret(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.k8sApi.deleteNamespacedSecret({ name, namespace })
  }

  async updateSecret(namespace: string, name: string, data: Record<string, string>) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    // Base64 编码数据
    const encodedData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64')
    }

    const secret: k8s.V1Secret = {
      metadata: { name, namespace },
      data: encodedData,
    }

    return await this.k8sApi.replaceNamespacedSecret({ name, namespace, body: secret })
  }

  // ==================== Deployment 操作 ====================

  async createDeployment(namespace: string, deployment: k8s.V1Deployment) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.appsApi.createNamespacedDeployment({ namespace, body: deployment })
  }

  async getDeployment(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.appsApi.readNamespacedDeployment({ name, namespace })
  }

  async listDeployments(namespace: string) {
    if (!this.isConnected) return []
    const response = await this.appsApi.listNamespacedDeployment({ namespace })
    return response.items
  }

  async deleteDeployment(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.appsApi.deleteNamespacedDeployment({ name, namespace })
  }

  async updateDeployment(namespace: string, name: string, deployment: k8s.V1Deployment) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.appsApi.replaceNamespacedDeployment({ name, namespace, body: deployment })
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

  async createService(namespace: string, service: k8s.V1Service) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.k8sApi.createNamespacedService({ namespace, body: service })
  }

  async deleteService(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return await this.k8sApi.deleteNamespacedService({ name, namespace })
  }

  // ==================== Custom Resources (Flux) ====================

  async patchNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
    name: string
    body: any
  }) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    // @kubernetes/client-node v1.4.0 的 patch 需要设置 Content-Type header
    // 通过 body 的 headers 属性传递
    const patchOptions = {
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }

    return await this.customObjectsApi.patchNamespacedCustomObject({
      group: options.group,
      version: options.version,
      namespace: options.namespace,
      plural: options.plural,
      name: options.name,
      body: options.body,
      ...patchOptions,
    })
  }

  async getNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
    name: string
  }) {
    if (!this.isConnected) throw new Error('K8s 未连接')

    return await this.customObjectsApi.getNamespacedCustomObject({
      group: options.group,
      version: options.version,
      namespace: options.namespace,
      plural: options.plural,
      name: options.name,
    })
  }

  async listNamespacedCustomObject(options: {
    group: string
    version: string
    namespace: string
    plural: string
  }) {
    if (!this.isConnected) return []

    const response = await this.customObjectsApi.listNamespacedCustomObject({
      group: options.group,
      version: options.version,
      namespace: options.namespace,
      plural: options.plural,
    })

    return (response as any).items || []
  }

  // ==================== Events ====================

  async getEvents(namespace: string) {
    if (!this.isConnected) return []

    const response = await this.k8sApi.listNamespacedEvent({ namespace })
    return response.items
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
      // 添加 annotation 触发 reconcile
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

  // ==================== 原始 API 访问 ====================

  getCoreApi(): k8s.CoreV1Api {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return this.k8sApi
  }

  getAppsApi(): k8s.AppsV1Api {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return this.appsApi
  }

  getCustomObjectsApi(): k8s.CustomObjectsApi {
    if (!this.isConnected) throw new Error('K8s 未连接')
    return this.customObjectsApi
  }
}
