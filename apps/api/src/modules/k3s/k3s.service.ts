import * as k8s from '@kubernetes/client-node'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class K3sService implements OnModuleInit {
  private kc: k8s.KubeConfig
  private k8sApi: k8s.CoreV1Api
  private appsApi: k8s.AppsV1Api
  private isConnected = false

  constructor(private config: ConfigService) {
    this.kc = new k8s.KubeConfig()
  }

  async onModuleInit() {
    await this.connect()
  }

  private async connect() {
    try {
      const kubeconfigPath = this.config.get<string>('KUBECONFIG_PATH')

      if (kubeconfigPath) {
        // 从文件加载配置
        this.kc.loadFromFile(kubeconfigPath)
      } else {
        // 尝试从默认位置加载
        this.kc.loadFromDefault()
      }

      this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api)
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)

      // 测试连接
      await this.k8sApi.listNamespace()
      this.isConnected = true
      console.log('✅ K3s 连接成功')
    } catch {
      this.isConnected = false
      console.warn('⚠️ K3s 连接失败，部署功能将不可用')
      console.warn('配置 KUBECONFIG_PATH 环境变量以启用 K3s')
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
      const response = await this.appsApi.createNamespacedDeployment({
        namespace,
        body: deployment,
      })
      return response
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Deployment 已存在，更新它
        const response = await this.appsApi.replaceNamespacedDeployment({
          name,
          namespace,
          body: deployment,
        })
        return response
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
      const response = await this.k8sApi.createNamespacedService({ namespace, body: service })
      return response
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Service 已存在，更新它
        const response = await this.k8sApi.replaceNamespacedService({
          name,
          namespace,
          body: service,
        })
        return response
      }
      throw error
    }
  }

  // 获取 Deployment 状态
  async getDeployment(namespace: string, name: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    const response = await this.appsApi.readNamespacedDeployment({ name, namespace })
    return response
  }

  // 列出 Deployments
  async listDeployments(namespace: string) {
    if (!this.isConnected) {
      return []
    }

    const response = await this.appsApi.listNamespacedDeployment({ namespace })
    return response.items || []
  }

  // 删除 Deployment
  async deleteDeployment(namespace: string, name: string) {
    if (!this.isConnected) {
      throw new Error('K3s 未连接')
    }

    await this.appsApi.deleteNamespacedDeployment({ name, namespace })
  }

  // 获取 Pods
  async getPods(namespace: string, labelSelector?: string) {
    if (!this.isConnected) {
      return []
    }

    const response = await this.k8sApi.listNamespacedPod({ namespace, labelSelector })
    return response.items || []
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

    const response = await this.appsApi.replaceNamespacedDeployment({
      name,
      namespace,
      body: deployment,
    })
    return response
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
      const response = await this.k8sApi.createNamespace({ body: namespace })
      return response
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Namespace 已存在
        const response = await this.k8sApi.readNamespace({ name })
        return response
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
    return response.items || []
  }
}
