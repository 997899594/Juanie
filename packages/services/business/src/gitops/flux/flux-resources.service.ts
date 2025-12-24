import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { GitConnectionsService } from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { load as loadYaml } from 'js-yaml'
import { CredentialManagerService } from '../credentials/credential-manager.service'
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
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private k3s: K3sService,
    private yamlGenerator: YamlGeneratorService,
    private metrics: FluxMetricsService,
    private credentialManager: CredentialManagerService,
    private gitConnectionsService: GitConnectionsService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(FluxResourcesService.name)
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
    timeout?: string
  }): Promise<GitRepository> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s is not connected')
    }

    const { name, namespace, url, branch = 'main', secretRef, interval = '1m', timeout } = data // 默认 1m，可通过参数覆盖

    // 生成 GitRepository YAML
    const gitRepoYaml = this.yamlGenerator.generateGitRepositoryYAML({
      name,
      namespace,
      url,
      branch,
      secretRef,
      interval,
      timeout,
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
      interval = '1m', // 默认 1m，可通过参数覆盖
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
   * 创建 ImagePullSecret（用于从 ghcr.io 拉取镜像）
   * 使用用户自己的 GitHub Token，支持多用户
   */
  private async createImagePullSecret(
    namespace: string,
    githubUsername: string,
    githubToken: string,
  ): Promise<void> {
    const registryHost = 'ghcr.io'

    this.logger.debug(
      `Creating ImagePullSecret with registry: ${registryHost}, username: ${githubUsername}`,
    )

    // 创建 Docker config JSON
    const dockerConfigJson = {
      auths: {
        [registryHost]: {
          username: githubUsername,
          password: githubToken,
          auth: Buffer.from(`${githubUsername}:${githubToken}`).toString('base64'),
        },
      },
    }

    try {
      // 创建 Secret
      await this.k3s.createSecret(
        namespace,
        'ghcr-secret',
        {
          '.dockerconfigjson': JSON.stringify(dockerConfigJson),
        },
        'kubernetes.io/dockerconfigjson',
      )

      this.logger.info(`✅ ImagePullSecret created in ${namespace} for user ${githubUsername}`)
    } catch (error: any) {
      // 如果 Secret 已存在，忽略错误
      if (error.message?.includes('409') || error.message?.includes('already exists')) {
        this.logger.debug(`ImagePullSecret already exists in ${namespace}`)
      } else {
        // 其他错误必须抛出，不能静默忽略
        this.logger.error(`Failed to create ImagePullSecret in ${namespace}:`, error)
        throw new Error(`Failed to create ImagePullSecret: ${error.message}`)
      }
    }
  }

  /**
   * 获取环境对应的轮询间隔
   * Development: 1m（快速迭代）
   * Staging: 3m（平衡）
   * Production: 5m（稳定可靠）
   */
  private getIntervalForEnvironment(envType: 'development' | 'staging' | 'production'): {
    gitRepo: string
    kustomization: string
  } {
    const intervals = {
      development: {
        gitRepo: '1m',
        kustomization: '1m',
      },
      staging: {
        gitRepo: '3m',
        kustomization: '3m',
      },
      production: {
        gitRepo: '5m',
        kustomization: '5m',
      },
    }

    return intervals[envType]
  }

  /**
   * 为项目设置完整的 GitOps 资源栈
   * 使用新的凭证管理器，自动处理认证
   * 使用环境差异化配置优化 API 调用
   */
  async setupProjectGitOps(data: {
    projectId: string
    repositoryId: string
    repositoryUrl: string
    repositoryBranch: string
    userId: string // 用于创建凭证
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
    const { projectId, repositoryId, repositoryUrl, repositoryBranch, userId, environments } = data

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
      // 1. 创建项目凭证
      this.logger.info(`Creating credential for project ${projectId}`)
      const credential = await this.credentialManager.createProjectCredential({ projectId, userId })

      // 1.5 获取用户的 GitHub 连接信息（用于 ImagePullSecret）
      let githubUsername: string
      let githubToken: string

      try {
        // 使用 GitConnectionsService 获取解密后的凭证
        const gitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
          userId,
          'github',
        )

        if (!gitConnection) {
          throw new Error(`No GitHub connection found for user ${userId}`)
        }

        if (!gitConnection.username) {
          throw new Error(
            `GitHub connection exists but username is missing. Please reconnect your GitHub account.`,
          )
        }

        if (!gitConnection.accessToken) {
          throw new Error(
            `GitHub connection exists but access token is missing. Please reconnect your GitHub account.`,
          )
        }

        githubUsername = gitConnection.username
        githubToken = gitConnection.accessToken

        this.logger.info(`✅ Retrieved GitHub credentials for user ${githubUsername}`)
      } catch (error) {
        this.logger.error('Failed to retrieve GitHub connection:', error)
        throw error // 不隐藏错误，直接抛出
      }

      // 2. 为每个环境设置 GitOps 资源
      for (const environment of environments) {
        const namespace = `project-${projectId}-${environment.type}`
        const gitRepoName = `${projectId}-repo`
        const kustomizationName = `${projectId}-${environment.type}`

        // 获取环境对应的轮询间隔
        const intervals = this.getIntervalForEnvironment(environment.type)

        try {
          // 2.1 创建 Namespace
          this.logger.info(`Creating namespace: ${namespace}`)
          await this.k3s.createNamespace(namespace)
          result.namespaces.push(namespace)

          // 2.2 创建 ImagePullSecret（用于拉取镜像）
          this.logger.info(`Creating ImagePullSecret in ${namespace}`)
          await this.createImagePullSecret(namespace, githubUsername, githubToken)

          // 2.3 同步 Git Secret 到新创建的 namespace
          this.logger.info(`Syncing Git secret to ${namespace}`)
          await this.credentialManager.syncToK8s(projectId, credential)

          // 2.3 创建 GitRepository
          this.logger.info(
            `Creating GitRepository: ${gitRepoName} in ${namespace} (interval: ${intervals.gitRepo})`,
          )

          // 确保使用 HTTPS URL
          const httpsUrl = this.convertToHttpsUrl(repositoryUrl)
          this.logger.info(`Using HTTPS URL: ${httpsUrl}`)

          const gitRepo = await this.createGitRepository({
            name: gitRepoName,
            namespace,
            url: httpsUrl,
            branch: repositoryBranch,
            secretRef: `${projectId}-git-auth`,
            interval: intervals.gitRepo, // 环境差异化配置
            timeout: '2m',
          })
          result.gitRepositories.push(`${namespace}/${gitRepoName}`)

          // 2.4 创建数据库记录 - GitRepository
          await this.db.insert(schema.gitopsResources).values({
            projectId,
            environmentId: environment.id,
            repositoryId,
            type: 'git-repository',
            name: gitRepoName,
            namespace,
            config: {
              url: httpsUrl,
              branch: repositoryBranch,
              secretRef: `${projectId}-git-auth`,
              interval: intervals.gitRepo, // 环境差异化配置
              timeout: '2m',
            } as any,
            status: gitRepo.status,
          })

          // 2.5 创建 Kustomization
          this.logger.info(
            `Creating Kustomization: ${kustomizationName} in ${namespace} (interval: ${intervals.kustomization})`,
          )
          const kustomization = await this.createKustomization({
            name: kustomizationName,
            namespace,
            gitRepositoryName: gitRepoName,
            path: `./k8s/overlays/${environment.type}`,
            prune: true,
            interval: intervals.kustomization, // 环境差异化配置
            timeout: '2m',
          })
          result.kustomizations.push(`${namespace}/${kustomizationName}`)

          // 2.6 创建数据库记录 - Kustomization
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
              interval: intervals.kustomization, // 环境差异化配置
              prune: true,
              timeout: '2m',
            } as any,
            status: kustomization.status,
          })

          this.logger.info(`✅ GitOps setup completed for environment: ${environment.type}`)
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
   * 手动触发项目部署
   * 强制 Flux 立即同步指定环境的 Kustomization
   */
  async reconcileProject(projectId: string, environment: string): Promise<void> {
    const namespace = `project-${projectId}-${environment}`
    const kustomizationName = `${projectId}-${environment}`

    this.logger.info(`Triggering deployment for project ${projectId} ${environment}`)

    // 强制 Flux 立即同步
    await this.k3s.reconcileKustomization(kustomizationName, namespace)

    this.logger.info(`✅ Deployment triggered for ${projectId} ${environment}`)
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
          this.logger.info(`Deleting namespace: ${namespace}`)
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
   * 将 SSH URL 转换为 HTTPS URL
   * 例如：git@github.com:user/repo.git -> https://github.com/user/repo.git
   */
  private convertToHttpsUrl(url: string): string {
    // 如果已经是 HTTPS，直接返回
    if (url.startsWith('https://')) {
      return url
    }

    // 转换 SSH URL 格式
    // git@github.com:user/repo.git -> https://github.com/user/repo.git
    // ssh://git@github.com/user/repo.git -> https://github.com/user/repo.git
    if (url.startsWith('git@') || url.startsWith('ssh://')) {
      const sshPattern = /^(?:ssh:\/\/)?git@([^:/]+)[:\\/](.+?)(?:\.git)?$/
      const match = url.match(sshPattern)

      if (match) {
        const [, host, path] = match
        return `https://${host}/${path}.git`
      }
    }

    // 如果无法识别格式，返回原 URL
    this.logger.warn(`Unable to convert URL to HTTPS: ${url}`)
    return url
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
      const plural = `${kind.toLowerCase()}s`

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
      const plural = `${kind.toLowerCase()}s`

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
