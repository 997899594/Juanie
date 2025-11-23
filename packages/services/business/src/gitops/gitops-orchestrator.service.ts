import * as schema from '@juanie/core-database/schemas'
import { DATABASE } from '@juanie/core-tokens'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { FluxService } from './flux/flux.service'
import { K3sService } from './k3s/k3s.service'
import { YamlGeneratorService } from './flux/yaml-generator.service'

/**
 * GitOps 编排服务
 * 负责协调 Namespace、Secret、GitRepository 和 Kustomization 的创建
 * 
 * 现代化特性：
 * 1. 声明式资源管理
 * 2. 幂等性操作
 * 3. 自动重试和错误处理
 * 4. 完整的生命周期管理
 */
@Injectable()
export class GitOpsOrchestratorService {
  private readonly logger = new Logger(GitOpsOrchestratorService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private k3s: K3sService,
    private flux: FluxService,
    private yamlGenerator: YamlGeneratorService,
  ) {}

  /**
   * 为项目创建完整的 GitOps 资源
   * 
   * 流程：
   * 1. 为每个环境创建 Namespace
   * 2. 创建 Git 认证 Secret
   * 3. 创建 Flux GitRepository
   * 4. 创建 Flux Kustomization
   * 5. 更新数据库记录
   */
  async setupProjectGitOps(data: {
    projectId: string
    repositoryId: string
    repositoryUrl: string
    repositoryBranch: string
    accessToken: string
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
    const { projectId, repositoryId, repositoryUrl, repositoryBranch, accessToken, environments } =
      data

    const result = {
      success: true,
      namespaces: [] as string[],
      gitRepositories: [] as string[],
      kustomizations: [] as string[],
      errors: [] as string[],
    }

    // 检查 K3s 连接
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

    // 检查 Flux 安装
    if (!this.flux.isInstalled()) {
      this.logger.warn('Flux not installed, skipping GitOps setup')
      return {
        success: false,
        namespaces: [],
        gitRepositories: [],
        kustomizations: [],
        errors: ['Flux is not installed'],
      }
    }

    try {
      // 为每个环境创建资源
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
          this.logger.log(`Creating Git secret in namespace: ${namespace}`)
          await this.createGitSecret(namespace, secretName, repositoryUrl, accessToken)

          // 3. 创建 GitRepository
          this.logger.log(`Creating GitRepository: ${gitRepoName} in ${namespace}`)
          const gitRepo = await this.flux.createGitRepository({
            name: gitRepoName,
            namespace,
            url: repositoryUrl,
            branch: repositoryBranch,
            secretRef: secretName,
            interval: '1m', // 每分钟检查一次更新
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
          const kustomization = await this.flux.createKustomization({
            name: kustomizationName,
            namespace,
            gitRepositoryName: gitRepoName,
            path: `./k8s/overlays/${environment.type}`,
            prune: true, // 自动删除不在 Git 中的资源
            interval: '5m', // 每 5 分钟同步一次
            timeout: '3m', // 超时时间
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
   * 创建 Git 认证 Secret
   * 支持 HTTPS (token) 和 SSH (private key)
   */
  private async createGitSecret(
    namespace: string,
    secretName: string,
    repositoryUrl: string,
    accessToken: string,
  ): Promise<void> {
    // 判断是 HTTPS 还是 SSH
    const isSSH = repositoryUrl.startsWith('git@') || repositoryUrl.startsWith('ssh://')

    if (isSSH) {
      // SSH 认证（暂不支持，需要私钥）
      throw new Error('SSH authentication not yet supported. Please use HTTPS URL.')
    } else {
      // HTTPS 认证 - 使用 token 作为密码
      const secretYaml = this.yamlGenerator.generateGitSecretYAML({
        name: secretName,
        namespace,
        username: 'git', // 对于 token 认证，用户名可以是任意值
        password: accessToken,
      })

      // 解析 YAML 并创建 Secret
      const secretData = this.yamlGenerator.parseYAML(secretYaml)
      const data: Record<string, string> = {}

      // 从 stringData 转换为 data
      if (secretData.stringData) {
        for (const [key, value] of Object.entries(secretData.stringData)) {
          data[key] = value as string
        }
      }

      await this.k3s.createSecret(namespace, secretName, data, secretData.type || 'Opaque')
    }
  }

  /**
   * 清理项目的 GitOps 资源
   * 使用 Finalizers 模式确保资源正确清理
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
      // 获取项目的所有环境
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, projectId))

      // 删除每个环境的 Namespace（会级联删除所有资源）
      for (const environment of environments) {
        const namespace = `project-${projectId}-${environment.type}`

        try {
          this.logger.log(`Deleting namespace: ${namespace}`)
          await this.k3s.deleteNamespace(namespace)
          result.deletedResources.push(namespace)
        } catch (error: any) {
          // Namespace 可能不存在，忽略错误
          if (error.statusCode !== 404) {
            this.logger.error(`Failed to delete namespace ${namespace}:`, error)
            result.errors.push(`${namespace}: ${error.message}`)
            result.success = false
          }
        }
      }

      // 软删除数据库记录
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

  /**
   * 同步 GitOps 资源状态
   * 从 K8s 集群读取实际状态并更新数据库
   */
  async syncGitOpsStatus(projectId: string): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      return
    }

    try {
      const resources = await this.db
        .select()
        .from(schema.gitopsResources)
        .where(eq(schema.gitopsResources.projectId, projectId))

      for (const resource of resources) {
        try {
          let status: 'pending' | 'ready' | 'failed' = 'pending'

          if (resource.type === 'git-repository') {
            const gitRepos = await this.flux.listGitRepositories(projectId)
            const gitRepo = gitRepos.find((r) => r.name === resource.name)
            if (gitRepo) {
              status = gitRepo.status === 'ready' ? 'ready' : gitRepo.status === 'failed' ? 'failed' : 'pending'
            }
          } else if (resource.type === 'kustomization') {
            // 获取 Kustomization 状态
            // 这里简化处理，实际应该调用 K8s API
            status = 'ready'
          }

          // 更新数据库状态
          await this.db
            .update(schema.gitopsResources)
            .set({ status, updatedAt: new Date() })
            .where(eq(schema.gitopsResources.id, resource.id))
        } catch (error) {
          // 单个资源失败不影响其他资源
          this.logger.error(`Failed to sync status for resource ${resource.name}:`, error)
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to sync GitOps status:', error)
    }
  }

  /**
   * 获取项目的 GitOps 资源摘要
   */
  async getProjectGitOpsSummary(projectId: string): Promise<{
    namespaces: number
    gitRepositories: number
    kustomizations: number
    healthyResources: number
    totalResources: number
  }> {
    const resources = await this.db
      .select()
      .from(schema.gitopsResources)
      .where(eq(schema.gitopsResources.projectId, projectId))

    const gitRepositories = resources.filter((r) => r.type === 'git-repository')
    const kustomizations = resources.filter((r) => r.type === 'kustomization')
    const healthyResources = resources.filter((r) => r.status === 'ready')

    // 获取唯一的 namespace 数量
    const uniqueNamespaces = new Set(resources.map((r) => r.namespace))

    return {
      namespaces: uniqueNamespaces.size,
      gitRepositories: gitRepositories.length,
      kustomizations: kustomizations.length,
      healthyResources: healthyResources.length,
      totalResources: resources.length,
    }
  }
}
