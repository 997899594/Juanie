import * as schema from '@juanie/core-database/schemas'
import { DATABASE } from '@juanie/core-tokens'
import { K3sService } from '../k3s/k3s.service'
import * as k8s from '@kubernetes/client-node'
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { FluxCliService } from './flux-cli.service'
import { FluxMetricsService } from './flux-metrics.service'
import { YamlGeneratorService } from './yaml-generator.service'

export interface FluxInstallation {
  namespace: string
  version: string
  components: string[]
  status: 'installed' | 'failed' | 'pending'
}

export interface GitRepository {
  id: string
  name: string
  namespace: string
  url: string
  branch: string
  secretRef?: string
  status: 'ready' | 'reconciling' | 'failed'
}

export interface Kustomization {
  id: string
  name: string
  namespace: string
  gitRepositoryName: string
  path: string
  prune: boolean
  status: 'ready' | 'reconciling' | 'failed'
}

export interface HelmRelease {
  id: string
  name: string
  namespace: string
  chartName: string
  chartVersion: string
  status: 'ready' | 'reconciling' | 'failed'
}

@Injectable()
export class FluxService implements OnModuleInit {
  private isFluxInstalled = false

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private config: ConfigService,
    private k3s: K3sService,
    private fluxCli: FluxCliService,
    private yamlGenerator: YamlGeneratorService,
    private metrics: FluxMetricsService,
  ) {}

  async onModuleInit() {
    // Check if Flux is already installed
    await this.checkFluxInstallation()
  }

  private async checkFluxInstallation() {
    try {
      if (!this.k3s.isK3sConnected()) {
        console.log('ℹ️  K3s not connected, skipping Flux check')
        return
      }

      // Check if flux-system namespace exists
      const namespaces = await this.k3s.listNamespaces()
      const fluxNamespace = namespaces.find((ns) => ns.metadata?.name === 'flux-system')

      if (fluxNamespace) {
        this.isFluxInstalled = true
        console.log('✅ Flux is already installed')
      } else {
        console.log('ℹ️  Flux is not installed')
      }
    } catch (error: any) {
      console.warn('⚠️  Failed to check Flux installation:', error.message)
    }
  }

  isInstalled(): boolean {
    return this.isFluxInstalled
  }

  async installFlux(options?: { namespace?: string; version?: string }): Promise<FluxInstallation> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s is not connected')
    }

    const namespace = options?.namespace || 'flux-system'
    const version = options?.version || 'latest'

    try {
      // Install Flux using CLI
      await this.fluxCli.install({
        namespace,
        version: version === 'latest' ? undefined : version,
      })

      this.isFluxInstalled = true

      return {
        namespace,
        version,
        components: [
          'source-controller',
          'kustomize-controller',
          'helm-controller',
          'notification-controller',
        ],
        status: 'installed',
      }
    } catch (error: any) {
      console.error('Failed to install Flux:', error)
      return {
        namespace,
        version,
        components: [],
        status: 'failed',
      }
    }
  }

  async checkFluxHealth(): Promise<{
    overall: 'healthy' | 'unhealthy' | 'unknown'
    components: Array<{
      name: string
      ready: boolean
      replicas?: number
    }>
  }> {
    if (!this.k3s.isK3sConnected()) {
      return {
        overall: 'unknown',
        components: [],
      }
    }

    if (!this.isFluxInstalled) {
      return {
        overall: 'unknown',
        components: [],
      }
    }

    try {
      const components = [
        'source-controller',
        'kustomize-controller',
        'helm-controller',
        'notification-controller',
      ]

      const health = await Promise.all(
        components.map(async (name) => {
          try {
            const deployment = await this.k3s.getDeployment('flux-system', name)
            const ready =
              deployment.status?.readyReplicas === deployment.spec?.replicas &&
              (deployment.status?.readyReplicas || 0) > 0

            // 记录组件健康状态指标
            this.metrics.updateComponentHealth(name, ready)

            return {
              name,
              ready,
              replicas: deployment.status?.replicas || 0,
            }
          } catch (error) {
            // 记录组件不健康
            this.metrics.updateComponentHealth(name, false)
            return {
              name,
              ready: false,
              replicas: 0,
            }
          }
        }),
      )

      const overall = health.every((c) => c.ready) ? 'healthy' : 'unhealthy'

      return {
        overall,
        components: health,
      }
    } catch (error: any) {
      console.error('Failed to check Flux health:', error)
      return {
        overall: 'unknown',
        components: [],
      }
    }
  }

  async uninstallFlux(): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s is not connected')
    }

    try {
      await this.fluxCli.uninstall()
      this.isFluxInstalled = false
    } catch (error: any) {
      console.error('Failed to uninstall Flux:', error)
      throw error
    }
  }

  /**
   * 创建 GitOps 资源（Kustomization 或 HelmRelease）
   */
  async createGitOpsResource(data: {
    projectId: string
    environmentId: string
    repositoryId: string
    type: 'kustomization' | 'helm'
    name: string
    namespace: string
    config: any
  }): Promise<any> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s 未连接')
    }

    const startTime = Date.now()

    // 1. 保存到数据库
    const [resource] = await this.db
      .insert(schema.gitopsResources)
      .values({
        projectId: data.projectId,
        environmentId: data.environmentId,
        repositoryId: data.repositoryId,
        type: data.type,
        name: data.name,
        namespace: data.namespace,
        config: data.config,
        status: 'pending',
      })
      .returning()

    try {
      // 2. 生成 YAML
      let yaml: string
      if (data.type === 'kustomization') {
        yaml = this.yamlGenerator.generateKustomizationYAML({
          name: data.name,
          namespace: data.namespace,
          gitRepositoryName: data.config.gitRepositoryName || data.name,
          path: data.config.path,
          interval: data.config.interval,
          prune: data.config.prune,
          timeout: data.config.timeout,
          retryInterval: data.config.retryInterval,
          healthChecks: data.config.healthChecks,
          dependsOn: data.config.dependsOn,
        })
      } else {
        yaml = this.yamlGenerator.generateHelmReleaseYAML({
          name: data.name,
          namespace: data.namespace,
          interval: data.config.interval,
          chartName: data.config.chartName,
          chartVersion: data.config.chartVersion,
          sourceType: data.config.sourceType || 'GitRepository',
          sourceName: data.config.sourceName || data.name,
          sourceNamespace: data.config.sourceNamespace,
          values: data.config.values,
          valuesFrom: data.config.valuesFrom,
          install: data.config.install,
          upgrade: data.config.upgrade,
        })
      }

      // 3. 应用到 K3s
      await this.applyYAMLToK3s(yaml)

      // 4. 更新状态为 reconciling
      if (resource) {
        await this.db
          .update(schema.gitopsResources)
          .set({
            status: 'reconciling',
            updatedAt: new Date(),
          })
          .where(eq(schema.gitopsResources.id, resource.id))
      }

      // 记录成功指标
      const duration = (Date.now() - startTime) / 1000
      if (data.type === 'kustomization') {
        this.metrics.recordKustomizationApply(data.name, data.namespace, 'success', duration)
      } else {
        this.metrics.recordHelmRelease(data.name, data.namespace, 'install', 'success', duration)
      }

      // 更新活跃资源数量
      this.metrics.updateActiveResources(data.type, 1)

      return resource
    } catch (error: any) {
      // 更新状态为 failed
      if (resource) {
        await this.db
          .update(schema.gitopsResources)
          .set({
            status: 'failed',
            errorMessage: error.message,
            updatedAt: new Date(),
          })
          .where(eq(schema.gitopsResources.id, resource.id))
      }

      // 记录失败指标
      const duration = (Date.now() - startTime) / 1000
      if (data.type === 'kustomization') {
        this.metrics.recordKustomizationApply(data.name, data.namespace, 'failed', duration)
      } else {
        this.metrics.recordHelmRelease(data.name, data.namespace, 'install', 'failed', duration)
      }

      throw error
    }
  }

  /**
   * 列出项目的所有 GitOps 资源
   */
  async listGitOpsResources(projectId: string): Promise<any[]> {
    const resources = await this.db.query.gitopsResources.findMany({
      where: and(
        eq(schema.gitopsResources.projectId, projectId),
        isNull(schema.gitopsResources.deletedAt),
      ),
      orderBy: [schema.gitopsResources.createdAt],
    })

    return resources
  }

  /**
   * 获取单个 GitOps 资源
   */
  async getGitOpsResource(id: string): Promise<any> {
    const resource = await this.db.query.gitopsResources.findFirst({
      where: and(eq(schema.gitopsResources.id, id), isNull(schema.gitopsResources.deletedAt)),
    })

    if (!resource) {
      throw new Error('GitOps 资源不存在')
    }

    return resource
  }

  /**
   * 更新 GitOps 资源
   */
  async updateGitOpsResource(
    id: string,
    data: {
      config?: any
      status?: string
      errorMessage?: string
    },
  ): Promise<any> {
    const resource = await this.getGitOpsResource(id)

    // 如果更新了配置，需要重新生成 YAML 并应用
    if (data.config) {
      try {
        let yaml: string
        if (resource.type === 'kustomization') {
          yaml = this.yamlGenerator.generateKustomizationYAML({
            name: resource.name,
            namespace: resource.namespace,
            gitRepositoryName: data.config.gitRepositoryName || resource.name,
            path: data.config.path,
            interval: data.config.interval,
            prune: data.config.prune,
            timeout: data.config.timeout,
            retryInterval: data.config.retryInterval,
            healthChecks: data.config.healthChecks,
            dependsOn: data.config.dependsOn,
          })
        } else {
          yaml = this.yamlGenerator.generateHelmReleaseYAML({
            name: resource.name,
            namespace: resource.namespace,
            interval: data.config.interval,
            chartName: data.config.chartName,
            chartVersion: data.config.chartVersion,
            sourceType: data.config.sourceType || 'GitRepository',
            sourceName: data.config.sourceName || resource.name,
            sourceNamespace: data.config.sourceNamespace,
            values: data.config.values,
            valuesFrom: data.config.valuesFrom,
            install: data.config.install,
            upgrade: data.config.upgrade,
          })
        }

        await this.applyYAMLToK3s(yaml)
      } catch (error: any) {
        throw new Error(`更新 GitOps 资源失败: ${error.message}`)
      }
    }

    // 更新数据库
    const [updated] = await this.db
      .update(schema.gitopsResources)
      .set({
        config: data.config || resource.config,
        status: data.status || resource.status,
        errorMessage: data.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.gitopsResources.id, id))
      .returning()

    return updated
  }

  /**
   * 删除 GitOps 资源（软删除）
   */
  async deleteGitOpsResource(id: string): Promise<void> {
    const resource = await this.getGitOpsResource(id)

    // 从 K3s 中删除资源
    try {
      await this.deleteK3sResource(resource.type, resource.name, resource.namespace)
    } catch (error: any) {
      console.warn(`从 K3s 删除资源失败: ${error.message}`)
    }

    // 软删除数据库记录
    await this.db
      .update(schema.gitopsResources)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.gitopsResources.id, id))

    // 更新活跃资源数量
    this.metrics.updateActiveResources(resource.type, -1)
  }

  /**
   * 手动触发 reconciliation
   */
  async triggerReconciliation(kind: string, name: string, namespace: string): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s 未连接')
    }

    const startTime = Date.now()

    try {
      await this.fluxCli.reconcile(kind, name, namespace)

      // 记录成功的 reconciliation
      const duration = (Date.now() - startTime) / 1000
      this.metrics.recordReconciliation(kind, name, namespace, 'success', duration)
    } catch (error) {
      // 记录失败的 reconciliation
      const duration = (Date.now() - startTime) / 1000
      this.metrics.recordReconciliation(kind, name, namespace, 'failed', duration)
      throw error
    }
  }

  /**
   * 应用 YAML 到 K3s
   */
  private async applyYAMLToK3s(yaml: string): Promise<void> {
    try {
      const kc = new k8s.KubeConfig()
      const kubeconfigPath =
        this.config.get<string>('KUBECONFIG_PATH') || this.config.get<string>('K3S_KUBECONFIG_PATH')

      if (kubeconfigPath) {
        let path = kubeconfigPath
        if (path.startsWith('~')) {
          const homeDir = process.env.HOME || process.env.USERPROFILE
          path = path.replace('~', homeDir || '')
        }
        kc.loadFromFile(path)
      } else {
        kc.loadFromDefault()
      }

      // 解析 YAML 并应用
      const obj = k8s.loadYaml(yaml)
      if (!obj || typeof obj !== 'object') {
        throw new Error('无效的 YAML')
      }

      const client = k8s.KubernetesObjectApi.makeApiClient(kc)

      try {
        await client.create(obj as k8s.KubernetesObject)
      } catch (error: any) {
        // 如果资源已存在，尝试更新
        if (error.statusCode === 409) {
          await client.patch(obj as k8s.KubernetesObject)
        } else {
          throw error
        }
      }
    } catch (error: any) {
      throw new Error(`应用 YAML 到 K3s 失败: ${error.message}`)
    }
  }

  /**
   * 从 K3s 删除资源
   */
  private async deleteK3sResource(kind: string, name: string, namespace: string): Promise<void> {
    try {
      const kc = new k8s.KubeConfig()
      const kubeconfigPath =
        this.config.get<string>('KUBECONFIG_PATH') || this.config.get<string>('K3S_KUBECONFIG_PATH')

      if (kubeconfigPath) {
        let path = kubeconfigPath
        if (path.startsWith('~')) {
          const homeDir = process.env.HOME || process.env.USERPROFILE
          path = path.replace('~', homeDir || '')
        }
        kc.loadFromFile(path)
      } else {
        kc.loadFromDefault()
      }

      const client = k8s.KubernetesObjectApi.makeApiClient(kc)

      // 构造资源对象用于删除
      const obj: k8s.KubernetesObject = {
        apiVersion:
          kind === 'kustomization' ? 'kustomize.toolkit.fluxcd.io/v1' : 'helm.toolkit.fluxcd.io/v2',
        kind: kind === 'kustomization' ? 'Kustomization' : 'HelmRelease',
        metadata: {
          name,
          namespace,
        },
      }

      await client.delete(obj)
    } catch (error: any) {
      throw new Error(`从 K3s 删除资源失败: ${error.message}`)
    }
  }

  /**
   * 创建 Flux GitRepository 资源
   * 使用 Server-Side Apply (SSA) 实现幂等性
   */
  async createGitRepository(data: {
    name: string
    namespace: string
    url: string
    branch?: string
    secretRef?: string
    interval?: string
  }): Promise<GitRepository> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s is not connected')
    }

    const {
      name,
      namespace,
      url,
      branch = 'main',
      secretRef,
      interval = '5m',
    } = data

    // 生成 GitRepository YAML
    const gitRepoYaml = this.yamlGenerator.generateGitRepositoryYAML({
      name,
      namespace,
      url,
      branch,
      secretRef,
      interval,
    })

    try {
      // 使用 Server-Side Apply 创建或更新资源
      await this.applyK3sResource(gitRepoYaml, namespace)

      // 等待资源就绪
      const status = await this.waitForGitRepositoryReady(name, namespace, 30000)

      return {
        id: `${namespace}/${name}`,
        name,
        namespace,
        url,
        branch,
        secretRef,
        status,
      }
    } catch (error: any) {
      throw new Error(`Failed to create GitRepository: ${error.message}`)
    }
  }

  /**
   * 列出项目的所有 GitRepository 资源
   */
  async listGitRepositories(projectId: string): Promise<GitRepository[]> {
    if (!this.k3s.isK3sConnected()) {
      return []
    }

    try {
      const resources = await this.db
        .select()
        .from(schema.gitopsResources)
        .where(
          and(
            eq(schema.gitopsResources.projectId, projectId),
            eq(schema.gitopsResources.type, 'git-repository'),
            isNull(schema.gitopsResources.deletedAt),
          ),
        )

      const gitRepos: GitRepository[] = []

      for (const resource of resources) {
        try {
          const k8sResource = await this.getK3sResource(
            'source.toolkit.fluxcd.io',
            'v1',
            resource.namespace,
            'gitrepositories',
            resource.name,
          )

          gitRepos.push({
            id: `${resource.namespace}/${resource.name}`,
            name: resource.name,
            namespace: resource.namespace,
            url: (resource.config as any).url || '',
            branch: (resource.config as any).branch || 'main',
            secretRef: (resource.config as any).secretRef,
            status: this.parseResourceStatus(k8sResource),
          })
        } catch (error) {
          // 资源可能已被删除，跳过
          continue
        }
      }

      return gitRepos
    } catch (error: any) {
      throw new Error(`Failed to list GitRepositories: ${error.message}`)
    }
  }

  /**
   * 创建 Flux Kustomization 资源
   */
  async createKustomization(data: {
    name: string
    namespace: string
    gitRepositoryName: string
    path: string
    prune?: boolean
    interval?: string
    timeout?: string
    dependsOn?: Array<{ name: string; namespace?: string }>
  }): Promise<Kustomization> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s is not connected')
    }

    const {
      name,
      namespace,
      gitRepositoryName,
      path,
      prune = true,
      interval = '5m',
      timeout = '2m',
      dependsOn,
    } = data

    // 生成 Kustomization YAML
    const kustomizationYaml = this.yamlGenerator.generateKustomizationYAML({
      name,
      namespace,
      gitRepositoryName,
      path,
      prune,
      interval,
      timeout,
      dependsOn,
    })

    try {
      // 使用 Server-Side Apply 创建或更新资源
      await this.applyK3sResource(kustomizationYaml, namespace)

      // 等待资源就绪
      const status = await this.waitForKustomizationReady(name, namespace, 60000)

      return {
        id: `${namespace}/${name}`,
        name,
        namespace,
        gitRepositoryName,
        path,
        prune,
        status,
      }
    } catch (error: any) {
      throw new Error(`Failed to create Kustomization: ${error.message}`)
    }
  }

  /**
   * 获取项目的 Flux 事件
   */
  async getEvents(projectId: string, limit = 50): Promise<any[]> {
    if (!this.k3s.isK3sConnected()) {
      return []
    }

    try {
      // 获取项目的所有 namespace
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(
          and(
            eq(schema.environments.projectId, projectId),
            isNull(schema.environments.deletedAt),
          ),
        )

      const namespaces = environments.map((env) => `project-${projectId}-${env.type}`)

      // 获取所有 namespace 的事件
      const allEvents: any[] = []

      for (const namespace of namespaces) {
        try {
          const events = await this.k3s.getEvents(namespace)
          allEvents.push(...events)
        } catch (error) {
          // Namespace 可能不存在，跳过
          continue
        }
      }

      // 按时间排序并限制数量
      return allEvents
        .sort((a, b) => {
          const timeA = new Date(a.lastTimestamp || a.metadata?.creationTimestamp || 0).getTime()
          const timeB = new Date(b.lastTimestamp || b.metadata?.creationTimestamp || 0).getTime()
          return timeB - timeA
        })
        .slice(0, limit)
    } catch (error: any) {
      throw new Error(`Failed to get events: ${error.message}`)
    }
  }

  /**
   * 使用 Server-Side Apply 应用资源
   * 这是现代化的 K8s 资源管理方式
   */
  private async applyK3sResource(yamlStr: string, namespace: string): Promise<void> {
    const resource = this.yamlGenerator.parseYAML(yamlStr)
    const { apiVersion, kind, metadata } = resource

    const [group, version] = apiVersion.includes('/')
      ? apiVersion.split('/')
      : ['', apiVersion]

    const plural = this.getPluralName(kind)

    try {
      const client = this.k3s.getCustomObjectsApi()

      // 使用 Server-Side Apply (SSA)
      await client.patchNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
        metadata.name,
        resource,
        undefined,
        undefined,
        undefined,
        {
          headers: {
            'Content-Type': 'application/apply-patch+yaml',
          },
        },
      )
    } catch (error: any) {
      // 如果资源不存在，使用 create
      if (error.statusCode === 404) {
        const client = this.k3s.getCustomObjectsApi()
        await client.createNamespacedCustomObject(
          group,
          version,
          namespace,
          plural,
          resource,
        )
      } else {
        throw error
      }
    }
  }

  /**
   * 等待 GitRepository 就绪
   */
  private async waitForGitRepositoryReady(
    name: string,
    namespace: string,
    timeout: number,
  ): Promise<'ready' | 'reconciling' | 'failed'> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const resource = await this.getK3sResource(
          'source.toolkit.fluxcd.io',
          'v1',
          namespace,
          'gitrepositories',
          name,
        )

        const status = this.parseResourceStatus(resource)
        if (status === 'ready' || status === 'failed') {
          return status
        }

        // 等待 2 秒后重试
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        // 资源可能还未创建，继续等待
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    return 'reconciling'
  }

  /**
   * 等待 Kustomization 就绪
   */
  private async waitForKustomizationReady(
    name: string,
    namespace: string,
    timeout: number,
  ): Promise<'ready' | 'reconciling' | 'failed'> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const resource = await this.getK3sResource(
          'kustomize.toolkit.fluxcd.io',
          'v1',
          namespace,
          'kustomizations',
          name,
        )

        const status = this.parseResourceStatus(resource)
        if (status === 'ready' || status === 'failed') {
          return status
        }

        // 等待 3 秒后重试
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        // 资源可能还未创建，继续等待
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    return 'reconciling'
  }

  /**
   * 获取 K8s 自定义资源
   */
  private async getK3sResource(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string,
  ): Promise<any> {
    const client = this.k3s.getCustomObjectsApi()
    const response = await client.getNamespacedCustomObject(
      group,
      version,
      namespace,
      plural,
      name,
    )
    return response.body
  }

  /**
   * 解析资源状态
   */
  private parseResourceStatus(resource: any): 'ready' | 'reconciling' | 'failed' {
    const conditions = resource.status?.conditions || []

    // 查找 Ready 条件
    const readyCondition = conditions.find((c: any) => c.type === 'Ready')

    if (!readyCondition) {
      return 'reconciling'
    }

    if (readyCondition.status === 'True') {
      return 'ready'
    }

    if (readyCondition.reason === 'Failed' || readyCondition.reason === 'Error') {
      return 'failed'
    }

    return 'reconciling'
  }

  /**
   * 获取资源的复数形式名称
   */
  private getPluralName(kind: string): string {
    const pluralMap: Record<string, string> = {
      GitRepository: 'gitrepositories',
      Kustomization: 'kustomizations',
      HelmRelease: 'helmreleases',
      HelmRepository: 'helmrepositories',
      Bucket: 'buckets',
      OCIRepository: 'ocirepositories',
    }

    return pluralMap[kind] || `${kind.toLowerCase()}s`
  }
}
