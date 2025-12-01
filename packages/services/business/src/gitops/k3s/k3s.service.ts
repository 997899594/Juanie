import {
  type K3sConnectedEvent,
  type K3sConnectionFailedEvent,
  K3sEvents,
} from '@juanie/core/events'
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { BunK8sClient } from './bun-k8s-client'

@Injectable()
export class K3sService implements OnModuleInit {
  private client!: BunK8sClient
  private isConnected = false
  private readonly logger = new Logger(K3sService.name)

  constructor(
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.connect()
  }

  private async connect() {
    let kubeconfigPath =
      this.config.get<string>('KUBECONFIG_PATH') || this.config.get<string>('K3S_KUBECONFIG_PATH')

    try {
      if (!kubeconfigPath) {
        const homeDir = process.env.HOME || process.env.USERPROFILE
        kubeconfigPath = `${homeDir}/.kube/config`
        this.logger.log('ℹ️  使用默认 kubeconfig 路径')
      } else {
        this.logger.log('📁 加载 kubeconfig:', kubeconfigPath)
        if (kubeconfigPath.startsWith('~')) {
          const homeDir = process.env.HOME || process.env.USERPROFILE
          kubeconfigPath = kubeconfigPath.replace('~', homeDir || '')
        }
      }

      this.client = new BunK8sClient(kubeconfigPath)
      await this.client.listNamespaces()

      this.isConnected = true
      this.logger.log('✅ K3s 连接成功')

      this.eventEmitter.emit(K3sEvents.CONNECTED, {
        timestamp: new Date(),
        kubeconfigPath,
      } as K3sConnectedEvent)
    } catch (error: any) {
      this.isConnected = false
      this.logger.warn(`⚠️ K3s 连接失败: ${error.message || error}`)
      this.logger.log('提示: 确保 K3s 集群正在运行，并且 kubeconfig 配置正确')

      this.eventEmitter.emit(K3sEvents.CONNECTION_FAILED, {
        timestamp: new Date(),
        error: error.message || String(error),
        kubeconfigPath,
      } as K3sConnectionFailedEvent)
    }
  }

  isK3sConnected(): boolean {
    return this.isConnected
  }

  async verifyAuthentication(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConnected) {
      return { valid: false, error: 'K3s not connected' }
    }

    try {
      await this.client.listNamespaces()
      return { valid: true }
    } catch (error: any) {
      return { valid: false, error: error.message || 'Authentication failed' }
    }
  }

  // Namespace 操作
  async createNamespace(name: string) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client.createNamespace(name)
  }

  async listNamespaces() {
    if (!this.isConnected) return []
    return this.client.listNamespaces()
  }

  async deleteNamespace(name: string) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client.deleteNamespace(name)
  }

  // Pod 操作
  async getPods(namespace: string, labelSelector?: string) {
    if (!this.isConnected) return []
    return this.client.listPods(namespace, labelSelector)
  }

  // Secret 操作
  async createSecret(
    namespace: string,
    name: string,
    data: Record<string, string>,
    type = 'Opaque',
  ) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client.createSecret(namespace, name, data, type)
  }

  // Deployment 操作
  async createDeployment(
    namespace: string,
    name: string,
    image: string,
    replicas = 1,
    env?: Record<string, string>,
  ) {
    if (!this.isConnected) throw new Error('K3s 未连接')

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name, namespace },
      spec: {
        replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [
              {
                name,
                image,
                env: env ? Object.entries(env).map(([key, value]) => ({ name: key, value })) : [],
              },
            ],
          },
        },
      },
    }

    return this.client.createDeployment(namespace, deployment)
  }

  async getDeployment(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client.getDeployment(namespace, name)
  }

  async listDeployments(namespace: string) {
    if (!this.isConnected) return []
    return this.client.listDeployments(namespace)
  }

  async deleteDeployment(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client.deleteDeployment(namespace, name)
  }

  async scaleDeployment(namespace: string, name: string, replicas: number) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    const deployment = (await this.getDeployment(namespace, name)) as any
    if (deployment?.spec) {
      deployment.spec.replicas = replicas
      return this.client.updateDeployment(namespace, name, deployment)
    }
    throw new Error('Deployment spec not found')
  }

  // Service 操作
  async createService(
    namespace: string,
    name: string,
    port: number,
    targetPort: number,
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' = 'ClusterIP',
  ) {
    if (!this.isConnected) throw new Error('K3s 未连接')

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace },
      spec: {
        type,
        selector: { app: name },
        ports: [{ port, targetPort }],
      },
    }

    return this.client.createService(namespace, service)
  }

  async deleteService(namespace: string, name: string) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client.deleteService(namespace, name)
  }

  // Events
  async getEvents(namespace: string, limit?: number) {
    if (!this.isConnected) return []
    const events = await this.client.getEvents(namespace)
    return limit ? events.slice(0, limit) : events
  }

  // Custom Resources (用于 Flux)
  getCustomObjectsApi(): BunK8sClient {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return this.client
  }

  // Pod 日志 (简化版)
  async getPodLogs(namespace: string, podName: string, _containerName?: string) {
    if (!this.isConnected) throw new Error('K3s 未连接')
    return `Logs for pod ${podName} in namespace ${namespace}`
  }
}
