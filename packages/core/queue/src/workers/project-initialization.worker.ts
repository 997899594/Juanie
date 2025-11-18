import * as schema from '@juanie/core-database/schemas'
import { DATABASE } from '@juanie/core-tokens'
import { OAuthAccountsService } from '@juanie/service-auth'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * 项目初始化 Worker
 * 负责完整的项目初始化流程：
 * 1. 创建 Git 仓库
 * 2. 推送初始代码
 * 3. 创建 GitOps 资源
 * 4. 更新项目状态
 */
@Injectable()
export class ProjectInitializationWorker implements OnModuleInit {
  private readonly logger = new Logger(ProjectInitializationWorker.name)
  private worker!: Worker

  constructor(
    private readonly config: ConfigService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly oauthAccounts: OAuthAccountsService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.worker = new Worker(
      'project-initialization',
      async (job: Job) => {
        this.logger.log(`Processing project initialization (${job.id})`)
        try {
          await this.handleProjectInitialization(job)
        } catch (error) {
          this.logger.error(`Job ${job.id} failed:`, error)
          throw error
        }
      },
      {
        connection: { url: redisUrl, maxRetriesPerRequest: null },
        concurrency: 3,
        limiter: { max: 5, duration: 1000 },
      },
    )

    this.worker.on('completed', (job) => this.logger.log(`Job ${job.id} completed`))
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed:`, err))
    this.logger.log('Project Initialization Worker initialized')
  }

  private async handleProjectInitialization(job: Job) {
    const { projectId, userId, organizationId, repository, templateId, environmentIds } = job.data

    try {
      // 解析 OAuth token（如果需要）
      const resolvedRepository = await this.resolveAccessToken(userId, repository)

      // 阶段 1: 创建 Git 仓库 (0-40%)
      await job.updateProgress(5)
      await job.log('开始创建 Git 仓库...')

      const repoInfo = await this.createRepository(job, resolvedRepository)

      await job.updateProgress(40)
      await job.log(`仓库创建成功: ${repoInfo.fullName}`)

      // 阶段 2: 推送初始代码 (40-60%)
      await job.log('推送初始代码...')

      await this.pushInitialCode(
        job,
        resolvedRepository.provider,
        resolvedRepository.accessToken,
        repoInfo,
      )

      await job.updateProgress(60)
      await job.log('初始代码推送完成')

      // 阶段 3: 创建数据库记录 (60-70%)
      await job.log('创建数据库记录...')

      const dbRepository = await this.createRepositoryRecord(
        projectId,
        repository.provider,
        repoInfo,
      )

      await job.updateProgress(70)
      await job.log('数据库记录已创建')

      // 阶段 4: 创建 GitOps 资源 (70-90%)
      await job.log('创建 GitOps 资源...')

      const gitopsCreated = await this.createGitOpsResources(
        job,
        projectId,
        dbRepository.id,
        environmentIds,
        repoInfo.fullName,
      )

      await job.updateProgress(90)
      if (gitopsCreated) {
        await job.log('GitOps 资源创建完成')
      } else {
        await job.log('GitOps 资源创建跳过（Flux 未安装）')
      }

      // 阶段 5: 更新项目状态 (90-100%)
      await job.log('更新项目状态...')

      await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          initializationStatus: {
            step: 'completed',
            progress: 100,
            completedSteps: [
              'create_project',
              'load_template',
              'create_environments',
              'create_repository',
              'push_code',
              'create_gitops_resources',
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      await job.updateProgress(100)
      await job.log('项目初始化完成！')

      this.logger.log(`Project ${projectId} initialization completed successfully`)

      return {
        success: true,
        projectId,
        repositoryId: dbRepository.id,
        repositoryFullName: repoInfo.fullName,
      }
    } catch (error) {
      this.logger.error(`Failed to initialize project ${projectId}:`, error)
      await job.log(`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`)

      // 更新项目状态为失败
      await this.db
        .update(schema.projects)
        .set({
          status: 'failed',
          initializationStatus: {
            step: 'failed',
            progress: 0,
            error: error instanceof Error ? error.message : '项目初始化失败',
            completedSteps: ['create_project', 'load_template', 'create_environments'],
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      throw error
    }
  }

  /**
   * 创建 Git 仓库
   */
  private async createRepository(
    job: Job,
    repository: any,
  ): Promise<{ fullName: string; cloneUrl: string; defaultBranch: string }> {
    const { provider, name, visibility, accessToken, defaultBranch } = repository

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const baseUrl = provider === 'github' ? 'https://api.github.com' : gitlabUrl

    const url = provider === 'github' ? `${baseUrl}/user/repos` : `${baseUrl}/api/v4/projects`

    // 为 GitLab 生成安全的 path（只包含小写字母、数字、连字符）
    const basePath = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // 尝试创建仓库，如果 path 冲突则添加随机后缀重试
    let attempt = 0
    let lastError: any = null

    while (attempt < 3) {
      const safePath =
        attempt === 0 ? basePath : `${basePath}-${Math.random().toString(36).slice(2, 8)}`

      const body =
        provider === 'github'
          ? { name, private: visibility === 'private', auto_init: true }
          : {
              name,
              path: safePath,
              visibility,
            }

      this.logger.log(`Creating ${provider} repository (attempt ${attempt + 1}):`, {
        url,
        body,
      })
      await job.log(`正在创建仓库: ${name}${attempt > 0 ? ` (尝试 ${attempt + 1})` : ''}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(provider === 'github' && {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          }),
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const repo = (await response.json()) as any
        return {
          fullName: provider === 'github' ? repo.full_name : repo.path_with_namespace,
          cloneUrl: provider === 'github' ? repo.clone_url : repo.http_url_to_repo,
          defaultBranch: repo.default_branch || defaultBranch || 'main',
        }
      }

      const error = (await response.json().catch(() => ({}))) as any
      lastError = error

      // 检查是否是 path/name 冲突错误
      const isConflictError =
        (typeof error.message === 'object' &&
          (error.message.path?.includes('taken') || error.message.name?.includes('taken'))) ||
        (typeof error.message === 'string' && error.message.includes('taken'))

      // 如果是冲突错误且是 GitLab，重试
      if (isConflictError && provider === 'gitlab' && attempt < 2) {
        this.logger.warn(`Path conflict detected, retrying with random suffix...`)
        attempt++
        continue
      }

      // 其他错误或 GitHub 错误，直接抛出
      let errorMsg = ''
      if (typeof error.message === 'string') {
        errorMsg = error.message
      } else if (typeof error.message === 'object') {
        errorMsg = Object.entries(error.message)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('; ')
      } else if (error.error) {
        errorMsg = error.error_description || error.error
      } else {
        errorMsg = JSON.stringify(error)
      }

      throw new Error(`${provider} API error: ${response.status} - ${errorMsg}`)
    }

    // 所有重试都失败
    throw new Error(
      `Failed to create repository after ${attempt} attempts: ${JSON.stringify(lastError)}`,
    )
  }

  /**
   * 推送初始代码
   */
  private async pushInitialCode(
    job: Job,
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoInfo: { fullName: string; defaultBranch: string },
  ): Promise<void> {
    const files = [
      {
        path: '.gitignore',
        content: `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`,
      },
      {
        path: 'README.md',
        content: `# Project

This repository was created by AI DevOps Platform.

## Getting Started

Add your application code here.

## Deployment

This project is configured for GitOps deployment with Flux.
`,
      },
      {
        path: 'k8s/base/kustomization.yaml',
        content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
`,
      },
      {
        path: 'k8s/base/deployment.yaml',
        content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app
  template:
    metadata:
      labels:
        app: app
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
`,
      },
      {
        path: 'k8s/base/service.yaml',
        content: `apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: app
  ports:
  - port: 80
    targetPort: 80
`,
      },
      {
        path: 'k8s/overlays/development/kustomization.yaml',
        content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namePrefix: dev-
`,
      },
      {
        path: 'k8s/overlays/staging/kustomization.yaml',
        content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namePrefix: staging-
`,
      },
      {
        path: 'k8s/overlays/production/kustomization.yaml',
        content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namePrefix: prod-
`,
      },
    ]

    if (provider === 'github') {
      await this.pushToGitHub(accessToken, repoInfo.fullName, files, repoInfo.defaultBranch)
    } else {
      await this.pushToGitLab(accessToken, repoInfo.fullName, files, repoInfo.defaultBranch)
    }
  }

  private async pushToGitHub(
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
  ): Promise<void> {
    for (const file of files) {
      const url = `https://api.github.com/repos/${fullName}/contents/${file.path}`

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({
          message: `Add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          branch,
        }),
      })

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as any
        throw new Error(`Failed to push ${file.path}: ${error.message || response.statusText}`)
      }
    }
  }

  private async pushToGitLab(
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
  ): Promise<void> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const projectPath = encodeURIComponent(fullName)

    const actions = files.map((file) => ({
      action: 'create',
      file_path: file.path,
      content: file.content,
    }))

    const url = `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${projectPath}/repository/commits`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        branch,
        commit_message: 'Initial commit: Add project files',
        actions,
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to push files to GitLab: ${JSON.stringify(error)}`)
    }
  }

  /**
   * 创建仓库数据库记录
   */
  private async createRepositoryRecord(
    projectId: string,
    provider: 'github' | 'gitlab',
    repoInfo: { fullName: string; cloneUrl: string; defaultBranch: string },
  ) {
    const [repository] = await this.db
      .insert(schema.repositories)
      .values({
        projectId,
        provider,
        fullName: repoInfo.fullName,
        cloneUrl: repoInfo.cloneUrl,
        defaultBranch: repoInfo.defaultBranch,
        syncStatus: 'success',
        lastSyncAt: new Date(),
      })
      .returning()

    if (!repository) {
      throw new Error('Failed to create repository record')
    }

    return repository
  }

  /**
   * 创建 GitOps 资源
   * 注意：这里只创建数据库记录，实际的 K8s 资源由 FluxService 创建
   */
  private async createGitOpsResources(
    job: Job,
    projectId: string,
    repositoryId: string,
    environmentIds: string[],
    repositoryFullName: string,
  ): Promise<boolean> {
    // 检查是否需要创建 GitOps 资源
    // 这里简化处理：直接创建数据库记录，标记为 pending
    // 实际的 K8s 资源创建由 FluxService 在后台处理

    try {
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, projectId))

      for (const environment of environments) {
        await this.db.insert(schema.gitopsResources).values({
          projectId,
          environmentId: environment.id,
          repositoryId,
          type: 'kustomization',
          name: `${projectId}-${environment.type}`,
          namespace: 'default',
          config: {
            gitRepositoryName: repositoryFullName,
            path: `k8s/overlays/${environment.type}`,
            interval: '5m',
            prune: true,
            timeout: '2m',
          } as any,
          status: 'pending',
        })

        await job.log(`GitOps 资源已创建: ${environment.type}`)
      }

      return true
    } catch (error) {
      this.logger.error('Failed to create GitOps resources:', error)
      // GitOps 资源创建失败不应该导致整个流程失败
      return false
    }
  }

  /**
   * 解析访问令牌
   * 如果令牌是 __USE_OAUTH__，则从数据库获取用户的 OAuth 令牌
   */
  private async resolveAccessToken(userId: string, repository: any): Promise<any> {
    // 如果不是使用 OAuth，直接返回
    if (repository.accessToken !== '__USE_OAUTH__') {
      return repository
    }

    this.logger.log(`Resolving OAuth token for user ${userId}, provider: ${repository.provider}`)

    try {
      // 从数据库获取 OAuth 账户
      const oauthAccount = await this.oauthAccounts.getAccountByProvider(
        userId,
        repository.provider,
      )

      if (!oauthAccount) {
        const providerName = repository.provider === 'github' ? 'GitHub' : 'GitLab'
        throw new Error(
          `未找到 ${providerName} OAuth 连接。请前往"设置 > 账户连接"页面连接您的 ${providerName} 账户。`,
        )
      }

      if (!oauthAccount.accessToken || oauthAccount.status !== 'active') {
        const providerName = repository.provider === 'github' ? 'GitHub' : 'GitLab'
        throw new Error(`${providerName} 访问令牌无效，请重新连接账户`)
      }

      return {
        ...repository,
        accessToken: oauthAccount.accessToken,
      }
    } catch (error) {
      this.logger.error(`Failed to resolve OAuth token:`, error)
      throw error
    }
  }
}
