import { K8sClientService } from '@juanie/core/k8s'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'
import * as yaml from 'yaml'
import { YamlGeneratorService } from './yaml-generator.service'

/**
 * Flux 资源管理服务
 *
 * 职责：
 * 1. 为项目创建 GitOps 资源（GitRepository + Kustomization）
 * 2. 管理 Git 认证 Secret
 * 3. 同步资源状态到数据库
 *
 * 架构：
 * - 使用 Core 层的 K8sClientService 操作 K8s
 * - 使用 YamlGeneratorService 生成 YAML
 * - 不重复造轮子，利用上游服务
 */
@Injectable()
export class FluxResourcesService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly k8sClient: K8sClientService,
    private readonly yamlGenerator: YamlGeneratorService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FluxResourcesService.name)
  }

  /**
   * 为项目设置 GitOps 资源
   *
   * 创建：
   * 1. Git 认证 Secret（如果需要）
   * 2. GitRepository 资源
   * 3. 每个环境的 Kustomization 资源
   * 4. 数据库记录
   */
  async setupProjectGitOps(options: {
    projectId: string
    repositoryId: string
    repositoryUrl: string
    repositoryBranch: string
    userId: string
    environments: Array<{
      id: string
      type: 'development' | 'staging' | 'production' | 'testing'
      name: string
    }>
    gitToken?: string // 可选：私有仓库需要
  }): Promise<{
    gitRepository: { id: string; name: string }
    kustomizations: Array<{ id: string; name: string; environmentId: string }>
  }> {
    // ✅ 使用完整 UUID 作为 namespace
    const namespace = `project-${options.projectId}`
    const gitRepoName = `${options.projectId.slice(0, 8)}-repo`
    const secretName = options.gitToken ? `${gitRepoName}-auth` : undefined

    try {
      // 1. 确保 namespace 存在
      const namespaceExists = await this.k8sClient.namespaceExists(namespace)
      if (!namespaceExists) {
        await this.k8sClient.createNamespace(namespace)
        this.logger.info(`Created namespace: ${namespace}`)
      }

      // 2. 创建 Git 认证 Secret（如果提供了 token）
      if (secretName && options.gitToken) {
        await this.createGitSecret(namespace, secretName, options.gitToken)
      }

      // 3. 创建 GitRepository 资源
      const gitRepository = await this.createGitRepository({
        projectId: options.projectId,
        repositoryId: options.repositoryId,
        name: gitRepoName,
        namespace,
        url: options.repositoryUrl,
        branch: options.repositoryBranch,
        secretRef: secretName,
      })

      // 4. 为每个环境创建 Kustomization 资源
      const kustomizations: Array<{ id: string; name: string; environmentId: string }> = []

      for (const env of options.environments) {
        const kustomization = await this.createKustomization({
          projectId: options.projectId,
          repositoryId: options.repositoryId,
          environmentId: env.id,
          name: `${options.projectId.slice(0, 8)}-${env.type}`,
          namespace,
          gitRepositoryName: gitRepoName,
          path: `./k8s/overlays/${env.type}`,
        })

        kustomizations.push(kustomization)
      }

      this.logger.info(
        `✅ GitOps setup completed for project ${options.projectId}: 1 GitRepository + ${kustomizations.length} Kustomizations`,
      )

      return {
        gitRepository,
        kustomizations,
      }
    } catch (error) {
      this.logger.error({ error, options }, 'Failed to setup GitOps resources')
      throw error
    }
  }

  /**
   * 创建 Git 认证 Secret
   */
  private async createGitSecret(
    namespace: string,
    secretName: string,
    token: string,
  ): Promise<void> {
    try {
      // 使用 K8sClientService 创建 Secret
      await this.k8sClient.createSecret(
        namespace,
        secretName,
        {
          username: 'git',
          password: token,
        },
        'kubernetes.io/basic-auth',
      )

      this.logger.debug(`Created Git secret: ${secretName} in ${namespace}`)
    } catch (error: any) {
      // 如果 Secret 已存在，更新它
      if (error.statusCode === 409) {
        await this.k8sClient.updateSecret(namespace, secretName, {
          username: 'git',
          password: token,
        })
        this.logger.debug(`Updated existing Git secret: ${secretName}`)
      } else {
        throw error
      }
    }
  }

  /**
   * 创建 GitRepository 资源
   */
  private async createGitRepository(options: {
    projectId: string
    repositoryId: string
    name: string
    namespace: string
    url: string
    branch: string
    secretRef?: string
  }): Promise<{ id: string; name: string }> {
    // 1. 生成 YAML
    const yamlContent = this.yamlGenerator.generateGitRepositoryYAML({
      name: options.name,
      namespace: options.namespace,
      url: options.url,
      branch: options.branch,
      interval: '1m',
      secretRef: options.secretRef,
    })

    // 2. 解析 YAML 为对象
    const resource = yaml.parse(yamlContent)

    // 3. 使用 K8sClientService 创建 Custom Resource
    try {
      await this.k8sClient.getCustomObjectsApi().createNamespacedCustomObject({
        group: 'source.toolkit.fluxcd.io',
        version: 'v1',
        namespace: options.namespace,
        plural: 'gitrepositories',
        body: resource,
      })

      this.logger.info(`Created GitRepository: ${options.name} in ${options.namespace}`)
    } catch (error: any) {
      // 如果资源已存在，跳过
      if (error.statusCode !== 409) {
        throw error
      }
      this.logger.debug(`GitRepository ${options.name} already exists`)
    }

    // 4. 保存到数据库
    const [dbRecord] = await this.db
      .insert(schema.gitopsResources)
      .values({
        projectId: options.projectId,
        repositoryId: options.repositoryId,
        // ✅ GitRepository 不属于特定环境，使用 undefined
        type: 'git-repository',
        name: options.name,
        namespace: options.namespace,
        status: 'pending',
        config: {
          interval: '1m',
        },
      })
      .returning()

    if (!dbRecord) {
      throw new Error('Failed to create GitRepository database record')
    }

    return {
      id: dbRecord.id,
      name: options.name,
    }
  }

  /**
   * 创建 Kustomization 资源
   */
  private async createKustomization(options: {
    projectId: string
    repositoryId: string
    environmentId: string
    name: string
    namespace: string
    gitRepositoryName: string
    path: string
  }): Promise<{ id: string; name: string; environmentId: string }> {
    // 1. 生成 YAML
    const yamlContent = this.yamlGenerator.generateKustomizationYAML({
      name: options.name,
      namespace: options.namespace,
      gitRepositoryName: options.gitRepositoryName,
      path: options.path,
      interval: '1m',
      prune: true,
    })

    // 2. 解析 YAML 为对象
    const resource = yaml.parse(yamlContent)

    // 3. 使用 K8sClientService 创建 Custom Resource
    try {
      await this.k8sClient.getCustomObjectsApi().createNamespacedCustomObject({
        group: 'kustomize.toolkit.fluxcd.io',
        version: 'v1',
        namespace: options.namespace,
        plural: 'kustomizations',
        body: resource,
      })

      this.logger.info(`Created Kustomization: ${options.name} in ${options.namespace}`)
    } catch (error: any) {
      // 如果资源已存在，跳过
      if (error.statusCode !== 409) {
        throw error
      }
      this.logger.debug(`Kustomization ${options.name} already exists`)
    }

    // 4. 保存到数据库
    const [dbRecord] = await this.db
      .insert(schema.gitopsResources)
      .values({
        projectId: options.projectId,
        repositoryId: options.repositoryId,
        environmentId: options.environmentId,
        type: 'kustomization',
        name: options.name,
        namespace: options.namespace,
        status: 'pending',
        config: {
          path: options.path,
          prune: true,
          interval: '1m',
        },
      })
      .returning()

    if (!dbRecord) {
      throw new Error('Failed to create Kustomization database record')
    }

    return {
      id: dbRecord.id,
      name: options.name,
      environmentId: options.environmentId,
    }
  }

  /**
   * 删除项目的所有 GitOps 资源
   */
  async cleanupProjectGitOps(projectId: string): Promise<void> {
    try {
      // 1. 从数据库获取所有资源
      const resources = await this.db
        .select()
        .from(schema.gitopsResources)
        .where(eq(schema.gitopsResources.projectId, projectId))

      // 2. 删除 K8s 资源
      for (const resource of resources) {
        try {
          if (resource.type === 'git-repository') {
            await this.k8sClient.getCustomObjectsApi().deleteNamespacedCustomObject({
              group: 'source.toolkit.fluxcd.io',
              version: 'v1',
              namespace: resource.namespace,
              plural: 'gitrepositories',
              name: resource.name,
            })
          } else if (resource.type === 'kustomization') {
            await this.k8sClient.getCustomObjectsApi().deleteNamespacedCustomObject({
              group: 'kustomize.toolkit.fluxcd.io',
              version: 'v1',
              namespace: resource.namespace,
              plural: 'kustomizations',
              name: resource.name,
            })
          }

          this.logger.debug(`Deleted ${resource.type}: ${resource.name}`)
        } catch (error: any) {
          // 如果资源不存在，忽略错误
          if (error.statusCode !== 404) {
            this.logger.warn(`Failed to delete ${resource.type} ${resource.name}:`, error.message)
          }
        }
      }

      // 3. 从数据库删除记录
      await this.db
        .delete(schema.gitopsResources)
        .where(eq(schema.gitopsResources.projectId, projectId))

      this.logger.info(`✅ Cleaned up GitOps resources for project ${projectId}`)
    } catch (error) {
      this.logger.error({ error, projectId }, 'Failed to cleanup GitOps resources')
      throw error
    }
  }
}
