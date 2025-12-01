import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { load as loadYaml } from 'js-yaml'
import { KnownHostsService } from '../git-auth/known-hosts.service'
import { K3sService } from '../k3s/k3s.service'
import { FluxMetricsService } from './flux-metrics.service'
import { YamlGeneratorService } from './yaml-generator.service'

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

/**
 * FluxResourcesService
 *
 * 职责：管理 Flux 资源的 CRUD 操作
 * - GitOps 资源管理（Kustomization, HelmRelease）
 * - GitRepository 管理
 * - Kustomization 管理
 * - 项目级 GitOps 编排
 */
@Injectable()
export class FluxResourcesService {
  private readonly logger = new Logger(FluxResourcesService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private config: ConfigService,
    private k3s: K3sService,
    private yamlGenerator: YamlGeneratorService,
    private metrics: FluxMetricsService,
    private knownHosts: KnownHostsService,
  ) {}

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

    const { name, namespace, url, branch = 'main', secretRef, interval = '5m' } = data

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

      // 等待资源就绪（由 FluxSyncService 处理）
      // 这里返回初始状态
      return {
        id: `${namespace}/${name}`,
        name,
        namespace,
        url,
        branch,
        secretRef,
        status: 'reconciling',
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
        gitRepos.push({
          id: `${resource.namespace}/${resource.name}`,
          name: resource.name,
          namespace: resource.namespace,
          url: (resource.config as any).url || '',
          branch: (resource.config as any).branch || 'main',
          secretRef: (resource.config as any).secretRef,
          status: resource.status as any,
        })
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

      return {
        id: `${namespace}/${name}`,
        name,
        namespace,
        gitRepositoryName,
        path,
        prune,
        status: 'reconciling',
      }
    } catch (error: any) {
      throw new Error(`Failed to create Kustomization: ${error.message}`)
    }
  }

  /**
   * 为项目设置完整的 GitOps 资源栈
   */
  async setupProjectGitOps(data: {
    projectId: string
    repositoryId: string
    repositoryUrl: string
    repositoryBranch: string
    credential: any // GitCredential 对象
    environments: Array<{
      id: string
      type: 'development' | 'staging' | 'production'
      name: string
    }>
  }): Promise<{
    success: boolean
    namespaces: string[]
    gitRepositories: string[]
    kustomizations: string[]
    errors: string[]
  }> {
    const { projectId, repositoryId, repositoryUrl, repositoryBranch, credential, environments } =
      data

    const result = {
      success: true,
      namespaces: [] as string[],
      gitRepositories: [] as string[],
      kustomizations: [] as string[],
      errors: [] as string[],
    }

    if (!this.k3s.isK3sConnected()) {
      this.logger.warn('K3s not connected, skipping GitOps setup')
      return {
        success: false,
        namespaces: [],
        gitRepositories: [],
        kustomizations: [],
        errors: ['K3s is not connected'],
      }
    }

    try {
      for (const environment of environments) {
        const namespace = `project-${projectId}-${environment.type}`
        const gitRepoName = `${projectId}-repo`
        const kustomizationName = `${projectId}-${environment.type}`
        const secretName = `${projectId}-git-auth`

        try {
          // 1. 创建 Namespace
          this.logger.log(`Creating namespace: ${namespace}`)
          await this.k3s.createNamespace(namespace)
          result.namespaces.push(namespace)

          // 2. 创建 Git 认证 Secret
          this.logger.log(`Creating Git secret ${secretName} in ${namespace}`)
          if (credential.type === 'github_deploy_key') {
            // GitHub Deploy Key 使用 SSH 认证
            // Flux 要求提供三个字段：
            // - 'ssh-privatekey': Kubernetes Secret 标准字段
            // - 'identity': Flux GitRepository 需要的字段（与 ssh-privatekey 相同）
            // - 'known_hosts': Git 提供商的 SSH 主机密钥（必需）

            // 动态获取 known_hosts
            const knownHostsContent = await this.knownHosts.getKnownHosts('github')

            await this.k3s.createSecret(
              namespace,
              secretName,
              {
                'ssh-privatekey': credential.token, // Kubernetes 标准字段
                identity: credential.token, // Flux 需要的字段
                known_hosts: knownHostsContent, // 动态获取的 known_hosts
              },
              'kubernetes.io/ssh-auth',
            )
          } else {
            // GitLab Project Access Token 使用 HTTP Basic Auth
            await this.k3s.createSecret(
              namespace,
              secretName,
              {
                username: 'git',
                password: credential.token,
              },
              'kubernetes.io/basic-auth',
            )
          }

          // 3. 创建 GitRepository
          this.logger.log(`Creating GitRepository: ${gitRepoName} in ${namespace}`)
          const gitRepo = await this.createGitRepository({
            name: gitRepoName,
            namespace,
            url: repositoryUrl,
            branch: repositoryBranch,
            secretRef: secretName,
            interval: '1m',
          })
          result.gitRepositories.push(`${namespace}/${gitRepoName}`)

          // 4. 创建数据库记录 - GitRepository
          await this.db.insert(schema.gitopsResources).values({
            projectId,
            environmentId: environment.id,
            repositoryId,
            type: 'git-repository',
            name: gitRepoName,
            namespace,
            config: {
              url: repositoryUrl,
              branch: repositoryBranch,
              secretRef: secretName,
              interval: '1m',
            } as any,
            status: gitRepo.status,
          })

          // 5. 创建 Kustomization
          this.logger.log(`Creating Kustomization: ${kustomizationName} in ${namespace}`)
          const kustomization = await this.createKustomization({
            name: kustomizationName,
            namespace,
            gitRepositoryName: gitRepoName,
            path: `./k8s/overlays/${environment.type}`,
            prune: true,
            interval: '5m',
            timeout: '3m',
          })
          result.kustomizations.push(`${namespace}/${kustomizationName}`)

          // 6. 创建数据库记录 - Kustomization
          await this.db.insert(schema.gitopsResources).values({
            projectId,
            environmentId: environment.id,
            repositoryId,
            type: 'kustomization',
            name: kustomizationName,
            namespace,
            config: {
              gitRepositoryName: gitRepoName,
              path: `./k8s/overlays/${environment.type}`,
              interval: '5m',
              prune: true,
              timeout: '3m',
            } as any,
            status: kustomization.status,
          })

          this.logger.log(`✅ GitOps setup completed for environment: ${environment.type}`)
        } catch (error: any) {
          this.logger.error(`Failed to setup GitOps for ${environment.type}:`, error)
          result.errors.push(`${environment.type}: ${error.message}`)
          result.success = false
        }
      }

      return result
    } catch (error: any) {
      this.logger.error('Failed to setup project GitOps:', error)
      return {
        success: false,
        namespaces: result.namespaces,
        gitRepositories: result.gitRepositories,
        kustomizations: result.kustomizations,
        errors: [...result.errors, error.message],
      }
    }
  }

  /**
   * 清理项目的所有 GitOps 资源
   */
  async cleanupProjectGitOps(projectId: string): Promise<{
    success: boolean
    deletedResources: string[]
    errors: string[]
  }> {
    const result = {
      success: true,
      deletedResources: [] as string[],
      errors: [] as string[],
    }

    if (!this.k3s.isK3sConnected()) {
      return result
    }

    try {
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, projectId))

      for (const environment of environments) {
        const namespace = `project-${projectId}-${environment.type}`

        try {
          this.logger.log(`Deleting namespace: ${namespace}`)
          await this.k3s.deleteNamespace(namespace)
          result.deletedResources.push(namespace)
        } catch (error: any) {
          if (error.statusCode !== 404) {
            this.logger.error(`Failed to delete namespace ${namespace}:`, error)
            result.errors.push(`${namespace}: ${error.message}`)
            result.success = false
          }
        }
      }

      await this.db
        .update(schema.gitopsResources)
        .set({ deletedAt: new Date() })
        .where(eq(schema.gitopsResources.projectId, projectId))

      return result
    } catch (error: any) {
      this.logger.error('Failed to cleanup project GitOps:', error)
      return {
        success: false,
        deletedResources: result.deletedResources,
        errors: [...result.errors, error.message],
      }
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 创建 Git 认证 Secret（已废弃，由 GitAuthService 处理）
   * 保留此方法以防需要手动创建 Secret
   */
  private async createGitSecret(
    namespace: string,
    secretName: string,
    repositoryUrl: string,
    accessToken: string,
  ): Promise<void> {
    // 此方法已废弃，Secret 由 GitAuthService.createK8sSecrets 创建
    this.logger.warn('createGitSecret is deprecated, secrets should be created by GitAuthService')
  }

  /**
   * 应用 YAML 到 K3s
   */
  private async applyYAMLToK3s(yaml: string): Promise<void> {
    try {
      const obj = loadYaml(yaml) as any
      if (!obj || typeof obj !== 'object') {
        throw new Error('无效的 YAML')
      }

      const client = this.k3s.getCustomObjectsApi()
      const { apiVersion, kind, metadata } = obj
      const [group, version] = apiVersion.split('/')
      const namespace = metadata.namespace || 'default'
      const name = metadata.name

      // 转换 kind 为复数形式
      const plural = kind.toLowerCase() + 's'

      try {
        await client.createCustomResource(group, version, plural, namespace, obj)
      } catch (error: any) {
        if (error.message?.includes('409') || error.message?.includes('already exists')) {
          // 资源已存在，尝试更新
          await client.deleteCustomResource(group, version, plural, namespace, name)
          await client.createCustomResource(group, version, plural, namespace, obj)
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
      const client = this.k3s.getCustomObjectsApi()

      const apiVersion =
        kind === 'kustomization' ? 'kustomize.toolkit.fluxcd.io/v1' : 'helm.toolkit.fluxcd.io/v2'
      const parts = apiVersion.split('/')
      const group = parts[0] || 'core'
      const version = parts[1] || 'v1'
      const plural = kind.toLowerCase() + 's'

      await client.deleteCustomResource(group, version, plural, namespace || 'default', name)
    } catch (error: any) {
      throw new Error(`从 K3s 删除资源失败: ${error.message}`)
    }
  }

  /**
   * 使用 Server-Side Apply 应用资源
   */
  private async applyK3sResource(yamlStr: string, namespace: string): Promise<void> {
    const resource = this.yamlGenerator.parseYAML(yamlStr)
    const { apiVersion, kind, metadata } = resource

    const [group, version] = apiVersion.includes('/') ? apiVersion.split('/') : ['', apiVersion]

    const plural = this.getPluralName(kind)

    this.logger.debug(`Applying ${kind} ${metadata.name} in ${namespace}`)
    this.logger.debug(`API: ${group}/${version}, Plural: ${plural}`)

    try {
      const client = this.k3s.getCustomObjectsApi()

      // Server-Side Apply requires fieldManager as query parameter
      const options = {
        headers: {
          'Content-Type': 'application/apply-patch+yaml',
        },
      }

      // 使用 Server-Side Apply
      await client.patchNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
        name: metadata.name,
        body: resource,
      })
      this.logger.debug(`Successfully patched ${kind} ${metadata.name}`)
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.logger.debug(`Resource not found, creating ${kind} ${metadata.name}`)
        try {
          const client = this.k3s.getCustomObjectsApi()
          await client.createNamespacedCustomObject({
            group,
            version,
            namespace,
            plural,
            body: resource,
          })
          this.logger.debug(`Successfully created ${kind} ${metadata.name}`)
        } catch (createError: any) {
          this.logger.error(`Failed to create ${kind}:`, {
            message: createError.message,
            body: createError.response?.body,
            statusCode: createError.statusCode,
          })
          throw createError
        }
      } else {
        this.logger.error(`Failed to patch ${kind}:`, {
          message: error.message,
          body: error.response?.body,
          statusCode: error.statusCode,
        })
        throw error
      }
    }
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
