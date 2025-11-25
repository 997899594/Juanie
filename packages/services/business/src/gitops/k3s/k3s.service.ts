import {
  type K3sConnectedEvent,
  type K3sConnectionFailedEvent,
  K3sEvents,
} from '@juanie/core/events'
import * as k8s from '@kubernetes/client-node'
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Injectable()
export class K3sService implements OnModuleInit {
  private kc: k8s.KubeConfig
  private k8sApi!: k8s.CoreV1Api
  private appsApi!: k8s.AppsV1Api
  private isConnected = false
  private readonly logger = new Logger(K3sService.name)

  constructor(
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.kc = new k8s.KubeConfig()
  }

  async onModuleInit() {
    await this.connect()
  }

  private async connect() {
    // 支持多个环境变量名
    let kubeconfigPath =
      this.config.get<string>('KUBECONFIG_PATH') || this.config.get<string>('K3S_KUBECONFIG_PATH')

    try {
      if (!kubeconfigPath) {
        // 尝试使用默认路径
        try {
          console.log('ℹ️  K3S_KUBECONFIG_PATH 未设置，尝试使用默认路径')
          this.kc.loadFromDefault()
        } catch (_error) {
          // 默认路径不存在，静默跳过
          this.isConnected = false
          console.log('ℹ️  K3s 未配置（可选功能）')
          return
        }
      } else {
        console.log('📁 加载 kubeconfig:', kubeconfigPath)
        // 展开 ~ 符号
        if (kubeconfigPath.startsWith('~')) {
          const homeDir = process.env.HOME || process.env.USERPROFILE
          kubeconfigPath = kubeconfigPath.replace('~', homeDir || '')
        }
        // 从文件加载配置
        this.kc.loadFromFile(kubeconfigPath)
      }

      // 开发环境或配置了跳过 TLS 验证时，禁用证书验证
      // 这对于 k3d 等本地开发集群是必需的（它们使用 0.0.0.0 导致证书验证失败）
      const skipTLSVerify =
        this.config.get<string>('NODE_ENV') === 'development' ||
        this.config.get<string>('K3S_SKIP_TLS_VERIFY') === 'true'

      if (skipTLSVerify) {
        const cluster = this.kc.getCurrentCluster()
        if (cluster) {
          // 使用 Object.defineProperty 修改只读属性
          Object.defineProperty(cluster, 'skipTLSVerify', {
            value: true,
            writable: true,
            configurable: true,
          })
        }
      }

      this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api)
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)

      // 测试连接
      await this.k8sApi.listNamespace()
      this.isConnected = true
      this.logger.log('✅ K3s 连接成功')

      // 发出连接成功事件
      this.eventEmitter.emit(K3sEvents.CONNECTED, {
        timestamp: new Date(),
        kubeconfigPath,
      } as K3sConnectedEvent)
    } catch (error: any) {
      this.isConnected = false
      this.logger.warn(`⚠️ K3s 连接失败: ${error.message || error}`)
      this.logger.log('提示: 确保 K3s 集群正在运行，并且 kubeconfig 配置正确')
      this.logger.debug('调试信息:', {
        kubeconfigPath,
        K3S_SKIP_TLS_VERIFY: this.config.get<string>('K3S_SKIP_TLS_VERIFY'),
        NODE_ENV: this.config.get<string>('NODE_ENV'),
      })

      // 发出连接失败事件
      this.eventEmitter.emit(K3sEvents.CONNECTION_FAILED, {
        timestamp: new Date(),
        error: error.message || String(error),
        kubeconfigPath,
      } as K3sConnectionFailedEvent)
    }
  }

  // 检查连接状态
  isK3sConnected(): boolean {
    return this.isConnected
  }

  /**
   * 验证 K3s 认证和权限
   * 尝试列出 namespaces 来验证认证是否有效
   */
  async verifyAuthentication(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConnected) {
      return { valid: false, error: 'K3s not connected' }
    }

    try {
      await this.k8sApi.listNamespace()
      return { valid: true }
    } catch (error: any) {
      this.logger.error('K3s authentication verification failed:', error.message)
      return {
        valid: false,
        error: error.message || 'Authentication failed',
      }
    }
  }

  // 创建 Deployment
  async createDeployment(
    namespace: string,
    name: string,
    image: string,
    replicas: number = 1,
    env?: Record<string, string>,
  ) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    const deployment: k8s.V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name,
        namespace,
      },
      spec: {
        replicas,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            containers: [
              {
                name,
                image,
                env: env
                  ? Object.entries(env).map(([key, value]) => ({
                      name: key,
                      value,
                    }))
                  : [],
              },
            ],
          },
        },
      },
    }

    try {
      const response = await this.appsApi.createNamespacedDeployment(namespace, deployment)
      return response.body
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Deployment 已存在，更新它
        const response = await this.appsApi.replaceNamespacedDeployment(name, namespace, deployment)
        return response.body
      }
      throw error
    }
  }

  // 创建 Service
  async createService(
    namespace: string,
    name: string,
    port: number,
    targetPort: number,
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' = 'ClusterIP',
  ) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name,
        namespace,
      },
      spec: {
        type,
        selector: {
          app: name,
        },
        ports: [
          {
            port,
            targetPort,
          },
        ],
      },
    }

    try {
      const response = await this.k8sApi.createNamespacedService(namespace, service)
      return response.body
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Service 已存在，更新它
        const response = await this.k8sApi.replaceNamespacedService(name, namespace, service)
        return response.body
      }
      throw error
    }
  }

  // 获取 Deployment 状态
  async getDeployment(namespace: string, name: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    const response = await this.appsApi.readNamespacedDeployment(name, namespace)
    return response.body
  }

  // 列出 Deployments
  async listDeployments(namespace: string) {
    if (!this.isConnected) {
      return []
    }

    const response = await this.appsApi.listNamespacedDeployment(namespace)
    return response.body.items || []
  }

  // 删除 Deployment
  async deleteDeployment(namespace: string, name: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    await this.appsApi.deleteNamespacedDeployment(name, namespace)
  }

  // 获取 Pods
  async getPods(namespace: string, labelSelector?: string) {
    if (!this.isConnected) {
      return []
    }

    const response = await this.k8sApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector,
    )
    return response.body.items || []
  }

  // 获取 Pod 日志
  async getPodLogs(namespace: string, podName: string, _containerName?: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    // 简化版本：返回日志提示
    // 实际实现需要使用 stream
    return `Logs for pod ${podName} in namespace ${namespace}`
  }

  // 扩缩容
  async scaleDeployment(namespace: string, name: string, replicas: number) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    const deployment = await this.getDeployment(namespace, name)
    if (deployment.spec) {
      deployment.spec.replicas = replicas
    }

    const response = await this.appsApi.replaceNamespacedDeployment(name, namespace, deployment)
    return response.body
  }

  // 创建 Namespace
  async createNamespace(name: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    const namespace: k8s.V1Namespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
      },
    }

    try {
      const response = await this.k8sApi.createNamespace(namespace)
      return response.body
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Namespace 已存在
        const response = await this.k8sApi.readNamespace(name)
        return response.body
      }
      throw error
    }
  }

  // 列出 Namespaces
  async listNamespaces() {
    if (!this.isConnected) {
      return []
    }

    const response = await this.k8sApi.listNamespace()
    return response.body.items || []
  }

  // 删除 Namespace
  async deleteNamespace(name: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    await this.k8sApi.deleteNamespace(name)
  }

  // 创建 Secret
  async createSecret(
    namespace: string,
    name: string,
    data: Record<string, string>,
    type: string = 'Opaque',
  ) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    // 将数据转换为 base64
    const encodedData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64')
    }

    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace,
      },
      type,
      data: encodedData,
    }

    try {
      const response = await this.k8sApi.createNamespacedSecret(namespace, secret)
      return response.body
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Secret 已存在，更新它
        const response = await this.k8sApi.replaceNamespacedSecret(name, namespace, secret)
        return response.body
      }
      throw error
    }
  }

  // 获取 CustomObjectsApi（用于 CRD）
  getCustomObjectsApi(): k8s.CustomObjectsApi {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }
    return this.kc.makeApiClient(k8s.CustomObjectsApi)
  }

  // 获取 Events
  async getEvents(namespace: string, limit?: number) {
    if (!this.isConnected) {
      return []
    }

    try {
      const response = await this.k8sApi.listNamespacedEvent(namespace)
      const events = response.body.items || []

      // 按时间排序
      events.sort((a, b) => {
        const timeA = new Date(a.lastTimestamp || a.metadata?.creationTimestamp || 0).getTime()
        const timeB = new Date(b.lastTimestamp || b.metadata?.creationTimestamp || 0).getTime()
        return timeB - timeA
      })

      return limit ? events.slice(0, limit) : events
    } catch (error) {
      return []
    }
  }

  // 获取 KubeConfig
  getKubeConfig(): k8s.KubeConfig {
    return this.kc
  }
}
