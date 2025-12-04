/**
 * Bun 原生 Kubernetes 客户端
 * 使用 Bun 的 fetch + TLS 支持，绕过 @kubernetes/client-node 的兼容性问题
 */
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'

/**
 * Kubernetes API 错误
 */
export class K8sApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusText: string,
    public body?: any,
  ) {
    super(message)
    this.name = 'K8sApiError'
  }
}

interface KubeconfigCluster {
  name: string
  cluster: {
    server: string
    'certificate-authority-data'?: string
    'insecure-skip-tls-verify'?: boolean
  }
}

interface KubeconfigUser {
  name: string
  user: {
    'client-certificate-data'?: string
    'client-key-data'?: string
    token?: string
  }
}

interface KubeconfigContext {
  name: string
  context: {
    cluster: string
    user: string
  }
}

interface Kubeconfig {
  clusters: KubeconfigCluster[]
  users: KubeconfigUser[]
  contexts: KubeconfigContext[]
  'current-context': string
}

export class BunK8sClient {
  private server: string
  private cert?: string
  private key?: string
  private token?: string
  private rejectUnauthorized: boolean

  constructor(kubeconfigPath: string) {
    const kubeconfigContent = readFileSync(kubeconfigPath, 'utf-8')
    const kubeconfig = load(kubeconfigContent) as Kubeconfig

    const currentContextName = kubeconfig['current-context']
    const context = kubeconfig.contexts.find((c) => c.name === currentContextName)
    if (!context) throw new Error('Current context not found')

    const cluster = kubeconfig.clusters.find((c) => c.name === context.context.cluster)
    if (!cluster) throw new Error('Cluster not found')

    const user = kubeconfig.users.find((u) => u.name === context.context.user)
    if (!user) throw new Error('User not found')

    this.server = cluster.cluster.server
    this.rejectUnauthorized = !cluster.cluster['insecure-skip-tls-verify']

    // 解码证书
    if (user.user['client-certificate-data']) {
      this.cert = Buffer.from(user.user['client-certificate-data'], 'base64').toString()
    }
    if (user.user['client-key-data']) {
      this.key = Buffer.from(user.user['client-key-data'], 'base64').toString()
    }
    if (user.user.token) {
      this.token = user.user.token
    }
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.server}${path}`

    const fetchOptions: any = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    // Bun 的 TLS 配置
    if (this.cert && this.key) {
      fetchOptions.tls = {
        cert: this.cert,
        key: this.key,
        rejectUnauthorized: this.rejectUnauthorized,
      }
    } else if (this.token) {
      fetchOptions.headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const text = await response.text()
      let body: any
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }

      throw new K8sApiError(
        `K8s API error: ${response.status} ${response.statusText}\n${text}`,
        response.status,
        response.statusText,
        body,
      )
    }

    return response.json()
  }

  // Namespace 操作
  async listNamespaces(): Promise<any[]> {
    const data = await this.request('/api/v1/namespaces')
    return (data as any).items || []
  }

  async createNamespace(name: string) {
    return this.request('/api/v1/namespaces', {
      method: 'POST',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name },
      }),
    })
  }

  async deleteNamespace(name: string) {
    return this.request(`/api/v1/namespaces/${name}`, {
      method: 'DELETE',
    })
  }

  // Pod 操作
  async listPods(namespace: string, labelSelector?: string): Promise<any[]> {
    let path = `/api/v1/namespaces/${namespace}/pods`
    if (labelSelector) {
      path += `?labelSelector=${encodeURIComponent(labelSelector)}`
    }
    const data = await this.request(path)
    return (data as any).items || []
  }

  // Secret 操作
  async createSecret(
    namespace: string,
    name: string,
    data: Record<string, string>,
    type = 'Opaque',
  ) {
    const encodedData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64')
    }

    return this.request(`/api/v1/namespaces/${namespace}/secrets`, {
      method: 'POST',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name, namespace },
        type,
        data: encodedData,
      }),
    })
  }

  // Custom Resources (用于 Flux)
  async getCustomResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    name: string,
  ) {
    return this.request(`/apis/${group}/${version}/namespaces/${namespace}/${plural}/${name}`)
  }

  async listCustomResources(
    group: string,
    version: string,
    plural: string,
    namespace?: string,
  ): Promise<any[]> {
    const path = namespace
      ? `/apis/${group}/${version}/namespaces/${namespace}/${plural}`
      : `/apis/${group}/${version}/${plural}`
    const data = await this.request(path)
    return (data as any).items || []
  }

  async createCustomResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    resource: any,
  ) {
    return this.request(`/apis/${group}/${version}/namespaces/${namespace}/${plural}`, {
      method: 'POST',
      body: JSON.stringify(resource),
    })
  }

  async deleteCustomResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    name: string,
  ) {
    return this.request(`/apis/${group}/${version}/namespaces/${namespace}/${plural}/${name}`, {
      method: 'DELETE',
    })
  }

  async patchNamespacedCustomObject(options: {
    group: string
    version: string
    plural: string
    namespace: string
    name: string
    body: any
  }) {
    const { group, version, plural, namespace, name, body } = options
    return this.request(`/apis/${group}/${version}/namespaces/${namespace}/${plural}/${name}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
      },
      body: JSON.stringify(body),
    })
  }

  async createNamespacedCustomObject(options: {
    group: string
    version: string
    plural: string
    namespace: string
    body: any
  }) {
    const { group, version, plural, namespace, body } = options
    return this.request(`/apis/${group}/${version}/namespaces/${namespace}/${plural}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async getNamespacedCustomObject(options: {
    group: string
    version: string
    plural: string
    namespace: string
    name: string
  }) {
    const { group, version, plural, namespace, name } = options
    return this.request(`/apis/${group}/${version}/namespaces/${namespace}/${plural}/${name}`)
  }

  // Deployment 操作
  async createDeployment(namespace: string, deployment: any) {
    return this.request(`/apis/apps/v1/namespaces/${namespace}/deployments`, {
      method: 'POST',
      body: JSON.stringify(deployment),
    })
  }

  async getDeployment(namespace: string, name: string) {
    return this.request(`/apis/apps/v1/namespaces/${namespace}/deployments/${name}`)
  }

  async listDeployments(namespace: string): Promise<any[]> {
    const data = await this.request(`/apis/apps/v1/namespaces/${namespace}/deployments`)
    return (data as any).items || []
  }

  async deleteDeployment(namespace: string, name: string) {
    return this.request(`/apis/apps/v1/namespaces/${namespace}/deployments/${name}`, {
      method: 'DELETE',
    })
  }

  async updateDeployment(namespace: string, name: string, deployment: any) {
    return this.request(`/apis/apps/v1/namespaces/${namespace}/deployments/${name}`, {
      method: 'PUT',
      body: JSON.stringify(deployment),
    })
  }

  // Service 操作
  async createService(namespace: string, service: any) {
    return this.request(`/api/v1/namespaces/${namespace}/services`, {
      method: 'POST',
      body: JSON.stringify(service),
    })
  }

  async deleteService(namespace: string, name: string) {
    return this.request(`/api/v1/namespaces/${namespace}/services/${name}`, {
      method: 'DELETE',
    })
  }

  // Events
  async getEvents(namespace: string): Promise<any[]> {
    const data = await this.request(`/api/v1/namespaces/${namespace}/events`)
    return (data as any).items || []
  }

  // 健康检查
  async healthCheck() {
    try {
      await this.request('/healthz')
      return true
    } catch {
      return false
    }
  }
}
