import * as k8s from '@kubernetes/client-node'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class K3sService implements OnModuleInit {
  private kc: k8s.KubeConfig
  private k8sApi!: k8s.CoreV1Api
  private appsApi!: k8s.AppsV1Api
  private isConnected = false

  constructor(private config: ConfigService) {
    this.kc = new k8s.KubeConfig()
  }

  async onModuleInit() {
    await this.connect()
  }

  private async connect() {
    try {
      // 支持多个环境变量名
      let kubeconfigPath =
        this.config.get<string>('KUBECONFIG_PATH') || this.config.get<string>('K3S_KUBECONFIG_PATH')

      if (!kubeconfigPath) {
        // 尝试使用默认路径
        try {
          this.kc.loadFromDefault()
        } catch (_error) {
          // 默认路径不存在，静默跳过
          this.isConnected = false
          console.log('ℹ️  K3s 未配置（可选功能）')
          return
        }
      } else {
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
      console.log('✅ K3s 连接成功')
    } catch (error: any) {
      this.isConnected = false
      console.warn('⚠️ K3s 连接失败:', error.message || error)
      console.log('提示: 确保 K3s 集群正在运行，并且 kubeconfig 配置正确')
    }
  }

  // 检查连接状态
  isK3sConnected(): boolean {
    return this.isConnected
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
}
