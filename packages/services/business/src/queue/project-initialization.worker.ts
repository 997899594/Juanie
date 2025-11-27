import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { OAuthAccountsService } from '@juanie/service-foundation'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import Redis from 'ioredis'
import { GitProviderService } from '../gitops/git-providers/git-provider.service'
import { ProjectInitializationService } from '../projects/project-initialization.service'

/**
 * 项目初始化 Worker
 *
 * 职责：
 * 1. 监听队列任务
 * 2. 协调初始化流程
 * 3. 更新进度
 * 4. 发布事件
 *
 * 业务逻辑委托给 ProjectInitializationService
 */
@Injectable()
export class ProjectInitializationWorker implements OnModuleInit {
  private readonly logger = new Logger(ProjectInitializationWorker.name)
  private worker!: Worker
  private redis: Redis

  constructor(
    private readonly config: ConfigService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly oauthAccounts: OAuthAccountsService,
    private readonly initService: ProjectInitializationService,
    private readonly gitProvider: GitProviderService,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'
    this.redis = new Redis(redisUrl)
  }

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

  /**
   * 更新进度并发布到 Redis（精简版）
   */
  private async updateProgress(job: Job, progress: number, message: string) {
    const projectId = job.data.projectId
    if (!projectId) return

    // 更新 BullMQ 进度
    await job.updateProgress(progress)

    const event = {
      type: 'initialization.progress',
      data: { projectId, progress, message },
      timestamp: Date.now(),
    }

    // 直接发布到 Redis Pub/Sub
    this.logger.debug(`Publishing progress: ${progress}% - ${message}`)
    await this.redis.publish(`project:${projectId}`, JSON.stringify(event))

    // 添加小延迟确保事件被处理
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  private async handleProjectInitialization(job: Job) {
    const { projectId, userId, repository, environmentIds } = job.data

    try {
      // 解析 OAuth token（如果需要）
      const resolvedRepository = await this.resolveAccessToken(userId, repository)

      // 阶段 1: 创建 Git 仓库 (0-40%)
      await this.updateProgress(job, 5, '开始创建 Git 仓库...')

      const repoInfo = await this.createRepository(job, resolvedRepository)
      await this.updateProgress(job, 40, `仓库创建成功: ${repoInfo.fullName}`)

      // 阶段 2: 推送渲染后的模板代码 (40-60%)
      await this.updateProgress(job, 45, '推送模板代码...')

      // 从渲染目录读取文件并推送
      const templateOutputDir = `/tmp/projects/${projectId}`
      await this.pushRenderedTemplate(
        job,
        resolvedRepository.provider,
        resolvedRepository.accessToken,
        repoInfo,
        templateOutputDir,
      )
      await this.updateProgress(job, 60, '模板代码推送完成')

      // 阶段 3: 创建数据库记录 (60-70%)
      await this.updateProgress(job, 65, '创建数据库记录...')

      const dbRepository = await this.createRepositoryRecord(
        projectId,
        repository.provider,
        repoInfo,
      )

      await this.updateProgress(job, 70, '数据库记录已创建')

      // 阶段 4: 创建 GitOps 资源 (70-90%)
      await this.updateProgress(job, 75, '创建 GitOps 资源...')

      const gitopsCreated = await this.createGitOpsResources(
        job,
        projectId,
        dbRepository.id,
        environmentIds,
        repoInfo.fullName,
      )

      if (gitopsCreated) {
        await this.updateProgress(job, 90, 'GitOps 资源创建完成')
      } else {
        await this.updateProgress(job, 90, 'GitOps 资源创建跳过（Flux 未安装）')
      }

      // 阶段 5: 更新项目状态 (90-100%)
      await this.updateProgress(job, 95, '更新项目状态...')

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

      await this.updateProgress(job, 100, '项目初始化完成！')

      // 推送初始化完成事件
      await this.redis.publish(
        `project:${projectId}`,
        JSON.stringify({
          type: 'initialization.completed',
          data: {
            projectId,
            repositoryId: dbRepository.id,
            repositoryFullName: repoInfo.fullName,
          },
          timestamp: Date.now(),
        }),
      )

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

      // 推送失败事件
      await this.redis.publish(
        `project:${projectId}`,
        JSON.stringify({
          type: 'initialization.failed',
          data: {
            projectId,
            error: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        }),
      )

      throw error
    }
  }

  /**
   * 创建 Git 仓库
   * 使用 GitProviderService 统一处理仓库创建
   */
  private async createRepository(
    job: Job,
    repository: any,
  ): Promise<{ fullName: string; cloneUrl: string; defaultBranch: string }> {
    const { provider, name, visibility, accessToken, defaultBranch } = repository

    await job.log(`正在创建仓库: ${name}`)

    try {
      const repoInfo = await this.gitProvider.createRepositoryWithRetry(
        provider as 'github' | 'gitlab',
        accessToken,
        {
          name,
          visibility: visibility === 'private' ? 'private' : 'public',
          defaultBranch: defaultBranch || 'main',
          autoInit: true,
        },
      )

      return {
        fullName: repoInfo.fullName,
        cloneUrl: repoInfo.cloneUrl,
        defaultBranch: repoInfo.defaultBranch,
      }
    } catch (error) {
      this.logger.error(`Failed to create repository:`, error)
      throw error
    }
  }

  /**
   * 推送渲染后的模板文件到 Git 仓库
   */
  private async pushRenderedTemplate(
    job: Job,
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoInfo: { fullName: string; defaultBranch: string },
    templateOutputDir: string,
  ): Promise<void> {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    // 递归读取目录中的所有文件
    const files: Array<{ path: string; content: string }> = []

    const readDirectory = async (dir: string, basePath = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

          // 跳过 .git 目录和其他不需要的文件
          if (entry.name === '.git' || entry.name === 'node_modules') {
            continue
          }

          if (entry.isDirectory()) {
            await readDirectory(fullPath, relativePath)
          } else if (entry.isFile()) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8')
              files.push({
                path: relativePath,
                content,
              })
            } catch (error) {
              // 跳过无法读取的文件（可能是二进制文件）
              this.logger.warn(`Skipping file ${relativePath}: ${error}`)
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to read directory ${dir}:`, error)
      }
    }

    await job.log(`正在读取模板文件: ${templateOutputDir}`)
    await readDirectory(templateOutputDir)

    if (files.length === 0) {
      this.logger.warn('No files found in template output directory, using fallback')
      await job.log('⚠️ 未找到模板文件，使用默认文件')
      // 使用默认文件作为后备
      await this.pushInitialCode(job, provider, accessToken, repoInfo)
      return
    }

    await job.log(`找到 ${files.length} 个文件，开始推送...`)

    await this.pushFilesToRepository(
      job,
      provider,
      accessToken,
      repoInfo.fullName,
      files,
      repoInfo.defaultBranch,
    )

    await job.log(`✅ 成功推送 ${files.length} 个文件`)
  }

  /**
   * 推送初始代码（后备方案）
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

    await this.pushFilesToRepository(
      job,
      provider,
      accessToken,
      repoInfo.fullName,
      files,
      repoInfo.defaultBranch,
    )
  }

  /**
   * 推送文件到 Git 仓库
   * 使用 GitProviderService 统一处理文件推送
   */
  private async pushFilesToRepository(
    job: Job,
    provider: 'github' | 'gitlab',
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
  ): Promise<void> {
    await this.updateProgress(job, 50, `批量推送 ${files.length} 个文件...`)

    try {
      await this.gitProvider.pushFiles(
        provider,
        accessToken,
        fullName,
        files,
        branch,
        `Initial commit: Add ${files.length} project files`,
      )
      this.logger.log(`✅ Successfully pushed ${files.length} files`)
    } catch (error) {
      this.logger.error(`Failed to push files:`, error)
      throw error
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
   * 使用 GitOpsOrchestratorService 创建完整的 GitOps 资源栈
   */
  private async createGitOpsResources(
    job: Job,
    projectId: string,
    repositoryId: string,
    _environmentIds: string[],
    repositoryFullName: string,
  ): Promise<boolean> {
    try {
      // 获取项目信息
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (!project) {
        throw new Error('Project not found')
      }

      // 获取项目的所有环境
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, projectId))

      // 获取仓库信息
      const [repository] = await this.db
        .select()
        .from(schema.repositories)
        .where(eq(schema.repositories.id, repositoryId))
        .limit(1)

      if (!repository) {
        throw new Error('Repository not found')
      }

      // 从 job data 获取 userId（在创建任务时传入）
      const userId = job.data.userId || ''
      if (!userId) {
        this.logger.warn('No userId in job data, skipping GitOps setup')
        await job.log('GitOps 资源创建已跳过（无用户信息）')
        return false
      }

      let accessToken: string | null = null

      try {
        // 获取用户的 OAuth 账户
        const oauthAccount = await this.oauthAccounts.getAccountByProvider(
          userId,
          repository.provider as 'github' | 'gitlab',
        )

        if (oauthAccount?.accessToken && oauthAccount.status === 'active') {
          accessToken = oauthAccount.accessToken
          this.logger.log(`✅ Retrieved OAuth token for ${repository.provider}`)
        } else {
          this.logger.warn(`No valid OAuth token found for ${repository.provider}`)
        }
      } catch (error) {
        this.logger.error('Failed to retrieve OAuth token:', error)
      }

      // 如果没有访问令牌，只创建数据库记录
      if (!accessToken) {
        await job.log('GitOps 资源创建已跳过（无有效的访问令牌）')

        // 创建数据库记录作为占位符
        for (const environment of environments) {
          await this.db.insert(schema.gitopsResources).values({
            projectId,
            environmentId: environment.id,
            repositoryId,
            type: 'kustomization',
            name: `${projectId}-${environment.type}`,
            namespace: `project-${projectId}-${environment.type}`,
            config: {
              gitRepositoryName: repositoryFullName,
              path: `k8s/overlays/${environment.type}`,
              interval: '5m',
              prune: true,
              timeout: '2m',
            } as any,
            status: 'pending',
          })

          await job.log(`GitOps 资源记录已创建: ${environment.type}`)
        }

        return false
      }

      // 使用事件驱动架构：发布 GitOps 设置请求事件
      await job.log('🚀 开始创建 GitOps 资源...')

      const success = await this.initService.requestGitOpsSetup({
        projectId,
        repositoryId,
        repositoryUrl: repository.cloneUrl,
        repositoryBranch: repository.defaultBranch || 'main',
        userId, // 用于获取 OAuth token
        environments: environments.map((env) => ({
          id: env.id,
          type: env.type as 'development' | 'staging' | 'production',
          name: env.name,
        })),
        jobId: job.id,
      })

      if (!success) {
        await job.log('❌ GitOps 资源创建失败')
        this.logger.error('GitOps setup failed')
        return false
      }

      await job.log('✅ GitOps 资源创建成功')
      this.logger.log('GitOps resources created successfully')

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
