import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { OAuthAccountsService } from '@juanie/service-foundation'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { GitProviderService } from '../gitops/git-providers/git-provider.service'
import { calculateStepProgress } from '../projects/initialization/initialization-steps'
import { ProgressManagerService } from '../projects/initialization/progress-manager.service'
import { ProjectsService } from '../projects/projects.service'

/**
 * 项目初始化 Worker
 *
 * 职责：
 * 1. 监听队列任务
 * 2. 协调初始化流程
 * 3. 更新进度
 * 4. 发布事件
 *
 * 业务逻辑委托给 ProjectsService
 */
@Injectable()
export class ProjectInitializationWorker implements OnModuleInit {
  private readonly logger = new Logger(ProjectInitializationWorker.name)
  private worker!: Worker

  constructor(
    private readonly config: ConfigService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly oauthAccounts: OAuthAccountsService,
    private readonly projectsService: ProjectsService,
    private readonly gitProvider: GitProviderService,
    private readonly progressManager: ProgressManagerService,
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

  /**
   * 更新进度（使用 ProgressManager 保证单调性）
   */
  private async updateProgress(job: Job, progress: number, message: string) {
    const projectId = job.data.projectId
    if (!projectId) return

    // 使用 ProgressManager 更新进度（自动保证单调性）
    const updated = await this.progressManager.updateProgress(projectId, progress, message)

    if (updated) {
      // 同步更新 BullMQ 进度
      await job.updateProgress(progress)
      await job.log(`[${progress}%] ${message}`)
    }
  }

  /**
   * 更新步骤内的进度
   */
  private async updateStepProgress(
    job: Job,
    stepName: string,
    stepProgress: number,
    message: string,
  ) {
    const totalProgress = calculateStepProgress(stepName, stepProgress)
    this.logger.debug(`[${stepName}] ${stepProgress}% -> 总进度 ${totalProgress}% - ${message}`)
    await this.updateProgress(job, totalProgress, message)

    // 添加延迟，避免进度更新过快导致前端渲染问题
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  private async handleProjectInitialization(job: Job) {
    const { projectId, userId, repository, environmentIds } = job.data

    try {
      // 解析 OAuth token（如果需要）
      const resolvedRepository = await this.resolveAccessToken(userId, repository)

      // 步骤 1: 创建 Git 仓库 (0-20%)
      await this.updateStepProgress(job, 'create_repository', 0, '开始创建 Git 仓库...')

      const repoInfo = await this.createRepository(job, resolvedRepository)

      await this.updateStepProgress(
        job,
        'create_repository',
        100,
        `仓库创建成功: ${repoInfo.fullName}`,
      )

      // 步骤 2: 推送模板代码 (20-50%)
      await this.updateStepProgress(job, 'push_template', 0, '准备推送模板代码...')

      const templateOutputDir = `/tmp/projects/${projectId}`
      await this.pushRenderedTemplate(
        job,
        resolvedRepository.provider,
        resolvedRepository.accessToken,
        repoInfo,
        templateOutputDir,
      )

      await this.updateStepProgress(job, 'push_template', 100, '模板代码推送完成')

      // 步骤 3: 创建数据库记录 (50-60%)
      await this.updateStepProgress(job, 'create_database_records', 0, '创建数据库记录...')

      const dbRepository = await this.createRepositoryRecord(
        projectId,
        repository.provider,
        repoInfo,
      )

      await this.updateStepProgress(job, 'create_database_records', 100, '数据库记录已创建')

      // 步骤 4: 配置 GitOps (60-90%)
      await this.updateStepProgress(job, 'setup_gitops', 0, '开始配置 GitOps...')

      const gitopsCreated = await this.createGitOpsResources(
        job,
        projectId,
        dbRepository.id,
        environmentIds,
        repoInfo.fullName,
      )

      if (gitopsCreated) {
        await this.updateStepProgress(job, 'setup_gitops', 100, 'GitOps 资源创建完成')
      } else {
        await this.updateStepProgress(
          job,
          'setup_gitops',
          100,
          'GitOps 资源创建跳过（Flux 未安装）',
        )
      }

      // 步骤 5: 完成初始化 (90-100%)
      await this.updateStepProgress(job, 'finalize', 0, '更新项目状态...')

      await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          initializationStatus: {
            step: 'completed',
            progress: 100,
            completedSteps: [
              'create_repository',
              'push_template',
              'create_database_records',
              'setup_gitops',
              'finalize',
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      await this.updateStepProgress(job, 'finalize', 100, '项目初始化完成！')

      // 标记完成（自动发布完成事件）
      await this.progressManager.markCompleted(projectId)

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

      // 标记失败（自动发布失败事件）
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.progressManager.markFailed(projectId, errorMessage)

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

    await this.updateStepProgress(job, 'create_repository', 30, `正在创建仓库: ${name}`)
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

      await this.updateStepProgress(job, 'create_repository', 70, '仓库创建成功，初始化分支...')

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

    // 读取模板文件
    await readDirectory(templateOutputDir)

    await this.updateStepProgress(job, 'push_template', 20, `找到 ${files.length} 个文件...`)

    // 检查是否有 k8s 目录
    const hasK8sFiles = files.some((f) => f.path.startsWith('k8s/'))

    if (files.length === 0) {
      this.logger.warn('No files found in template output directory, using fallback')
      await this.updateStepProgress(job, 'push_template', 30, '使用默认模板文件...')
      await this.pushInitialCode(job, provider, accessToken, repoInfo)
      return
    }

    // 如果模板文件中没有 k8s 目录，添加默认的 k8s 配置
    if (!hasK8sFiles) {
      this.logger.warn('Template files do not include k8s directory, adding default k8s config')
      await this.updateStepProgress(job, 'push_template', 30, '添加 Kubernetes 配置...')

      // 添加默认的 k8s 文件
      const k8sFiles = this.getDefaultK8sFiles()
      files.push(...k8sFiles)

      this.logger.log(`Added ${k8sFiles.length} k8s files to template`)
    }

    await this.updateStepProgress(job, 'push_template', 40, `准备推送 ${files.length} 个文件...`)

    await this.pushFilesToRepository(
      job,
      provider,
      accessToken,
      repoInfo.fullName,
      files,
      repoInfo.defaultBranch,
    )

    await this.updateStepProgress(job, 'push_template', 80, `成功推送 ${files.length} 个文件`)
  }

  /**
   * 获取默认的 k8s 配置文件
   */
  private getDefaultK8sFiles(): Array<{ path: string; content: string }> {
    return [
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

namePrefix: development-
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

namePrefix: production-
`,
      },
    ]
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
    await this.updateStepProgress(job, 'push_template', 60, `正在推送 ${files.length} 个文件...`)

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
    _repositoryFullName: string,
  ): Promise<boolean> {
    try {
      await this.updateStepProgress(job, 'setup_gitops', 10, '获取项目信息...')

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

      await this.updateStepProgress(job, 'setup_gitops', 20, '获取仓库信息...')

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

      await this.updateStepProgress(job, 'setup_gitops', 30, '验证访问权限...')

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
              gitRepositoryName: _repositoryFullName,
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
      await this.updateStepProgress(job, 'setup_gitops', 50, '创建 Kubernetes 资源...')
      await job.log('🚀 开始创建 GitOps 资源...')

      const success = await this.projectsService.requestGitOpsSetup({
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

      await this.updateStepProgress(job, 'setup_gitops', 80, '配置 Flux CD...')
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
