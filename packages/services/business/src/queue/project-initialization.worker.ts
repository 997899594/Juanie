import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { GitConnectionsService } from '@juanie/service-foundation'
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { FluxResourcesService } from '../gitops/flux/flux-resources.service'
import { GitProviderService } from '../gitops/git-providers/git-provider.service'
import { calculateStepProgress } from '../projects/initialization/initialization-steps'
import { InitializationStepsService } from '../projects/initialization/initialization-steps.service'
import { ProgressManagerService } from '../projects/initialization/progress-manager.service'
import { TemplateRenderer } from '../projects/template-renderer.service'

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
  private worker!: Worker

  constructor(
    private readonly config: ConfigService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly gitConnections: GitConnectionsService,
    private readonly gitProvider: GitProviderService,
    private readonly progressManager: ProgressManagerService,
    private readonly initializationSteps: InitializationStepsService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly fluxResources: FluxResourcesService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(ProjectInitializationWorker.name)
  }

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.worker = new Worker(
      'project-initialization',
      async (job: Job) => {
        this.logger.info(`Processing project initialization (${job.id})`)
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

    this.worker.on('completed', (job) => this.logger.info(`Job ${job.id} completed`))
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed:`, err))
    this.logger.info('Project Initialization Worker initialized')
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
      const resolvedRepository = await this.gitConnections.resolveRepositoryConfig(
        userId,
        repository,
      )
      this.logger.info(`✅ Resolved repository config, username: ${resolvedRepository.username}`)

      // 步骤 1: 创建 Git 仓库 (0-20%)
      await this.initializationSteps.startStep(projectId, 'create_repository')
      await this.updateStepProgress(job, 'create_repository', 0, '开始创建 Git 仓库...')

      const repoInfo = await this.createRepository(job, resolvedRepository)

      await this.updateStepProgress(
        job,
        'create_repository',
        100,
        `仓库创建成功: ${repoInfo.fullName}`,
      )
      await this.initializationSteps.completeStep(projectId, 'create_repository')

      // 步骤 2: 推送模板代码 (20-50%)
      await this.initializationSteps.startStep(projectId, 'push_template')
      await this.updateStepProgress(job, 'push_template', 0, '准备推送模板代码...')

      // 获取项目信息用于模板变量
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (!project) {
        throw new Error('Project not found')
      }

      // 使用模板系统推送代码
      await this.pushTemplateCode(
        job,
        project,
        resolvedRepository.provider,
        resolvedRepository.accessToken,
        repoInfo,
        resolvedRepository.username, // 传递 GitHub 用户名
      )

      await this.updateStepProgress(job, 'push_template', 100, '模板代码推送完成')
      await this.initializationSteps.completeStep(projectId, 'push_template')

      // 步骤 3: 创建数据库记录 (50-60%)
      await this.initializationSteps.startStep(projectId, 'create_database_records')
      await this.updateStepProgress(job, 'create_database_records', 0, '创建数据库记录...')

      const dbRepository = await this.createRepositoryRecord(
        projectId,
        repository.provider,
        repoInfo,
      )

      await this.updateStepProgress(job, 'create_database_records', 100, '数据库记录已创建')
      await this.initializationSteps.completeStep(projectId, 'create_database_records')

      // 步骤 4: 配置 GitOps (60-90%)
      await this.initializationSteps.startStep(projectId, 'setup_gitops')
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
        await this.initializationSteps.completeStep(projectId, 'setup_gitops')
      } else {
        await this.updateStepProgress(
          job,
          'setup_gitops',
          100,
          'GitOps 资源创建跳过（Flux 未安装）',
        )
        await this.initializationSteps.skipStep(projectId, 'setup_gitops', 'Flux 未安装')
      }

      // 步骤 5: 完成初始化 (90-100%)
      await this.initializationSteps.startStep(projectId, 'finalize')
      await this.updateStepProgress(job, 'finalize', 0, '更新项目状态...')

      await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          initializationCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      await this.updateStepProgress(job, 'finalize', 100, '项目初始化完成！')
      await this.initializationSteps.completeStep(projectId, 'finalize')

      // 标记完成（自动发布完成事件）
      await this.progressManager.markCompleted(projectId)

      this.logger.info(`Project ${projectId} initialization completed successfully`)

      return {
        success: true,
        projectId,
        repositoryId: dbRepository.id,
        repositoryFullName: repoInfo.fullName,
      }
    } catch (error) {
      this.logger.error(`Failed to initialize project ${projectId}:`, error)
      await job.log(`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`)

      // 标记当前步骤失败
      const currentStep = await this.initializationSteps.getCurrentStep(projectId)
      if (currentStep && currentStep.status === 'running') {
        await this.initializationSteps.failStep(
          projectId,
          currentStep.step,
          error instanceof Error ? error.message : '未知错误',
          error instanceof Error ? error.stack : undefined,
        )
      }

      // 更新项目状态为失败
      await this.db
        .update(schema.projects)
        .set({
          status: 'failed',
          initializationError: error instanceof Error ? error.message : '项目初始化失败',
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

      await this.updateStepProgress(job, 'create_repository', 70, '仓库创建成功')

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
   * 推送模板代码（使用模板系统）
   */
  private async pushTemplateCode(
    job: Job,
    project: typeof schema.projects.$inferSelect,
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoInfo: { fullName: string; cloneUrl: string; defaultBranch: string },
    githubUsername?: string, // 添加 GitHub 用户名参数
  ): Promise<void> {
    await this.updateStepProgress(job, 'push_template', 10, '准备模板变量...')

    // 准备模板变量
    const templateVariables = {
      // 项目信息
      projectId: project.id,
      projectName: project.name,
      projectSlug: project.slug,
      description: project.description || `${project.name} - AI DevOps Platform`,

      // GitHub 信息（用于镜像路径）
      githubUsername: githubUsername || 'unknown',

      // K8s 配置
      appName: project.slug,
      registry: 'ghcr.io', // 固定为 ghcr.io
      port: 3000,
      domain: this.config.get('APP_DOMAIN') || 'example.com',
      replicas: 1,

      // 平台 API 配置（用于 CI/CD 回调）
      platformApiUrl: this.config.get('PLATFORM_API_URL') || 'http://localhost:3000',

      // 可选功能（从项目配置获取，默认 false）
      enableDatabase: false,
      enableCache: false,
      enableAuth: false,
      enableSentry: false,

      // 资源配置
      resources: {
        requests: { cpu: '200m', memory: '512Mi' },
        limits: { cpu: '1000m', memory: '1Gi' },
      },

      // 仓库信息
      repository: {
        url: repoInfo.cloneUrl,
        branch: repoInfo.defaultBranch,
      },
    }

    await this.updateStepProgress(job, 'push_template', 20, '渲染模板文件...')

    // 使用模板系统渲染（内存操作）
    const files = await this.templateRenderer.renderTemplateToMemory(
      'nextjs-15-app',
      templateVariables,
    )

    await this.updateStepProgress(
      job,
      'push_template',
      40,
      `已渲染 ${files.length} 个文件，准备推送...`,
    )

    // 推送到 Git 仓库
    await this.pushFilesToRepository(
      job,
      provider,
      accessToken,
      repoInfo.fullName,
      files,
      repoInfo.defaultBranch,
    )

    await this.updateStepProgress(job, 'push_template', 80, `成功推送 ${files.length} 个文件`)

    // Push 事件会自动触发 GitHub Actions workflow
    await this.updateStepProgress(
      job,
      'push_template',
      95,
      '代码推送完成，镜像构建将自动开始（约 3-5 分钟）',
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
      this.logger.info(`✅ Successfully pushed ${files.length} files`)
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
        status: 'success',
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
        // 使用公共方法解析凭证
        const credentials = await this.gitConnections.resolveCredentials(
          userId,
          repository.provider as 'github' | 'gitlab',
        )

        if (credentials?.accessToken) {
          accessToken = credentials.accessToken
          this.logger.info(`✅ Retrieved OAuth token for ${repository.provider}`)
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

      // 直接同步创建 GitOps 资源（不使用事件）
      await this.updateStepProgress(job, 'setup_gitops', 50, '创建 Kubernetes 资源...')
      await job.log('🚀 开始创建 GitOps 资源...')

      const result = await this.fluxResources.setupProjectGitOps({
        projectId,
        repositoryId,
        repositoryUrl: repository.cloneUrl,
        repositoryBranch: repository.defaultBranch || 'main',
        userId,
        environments: environments.map((env) => ({
          id: env.id,
          type: env.type as 'development' | 'staging' | 'production',
          name: env.name,
        })),
      })

      if (!result.success) {
        await job.log(`❌ GitOps 资源创建失败: ${result.errors.join(', ')}`)
        this.logger.error('GitOps setup failed:', result.errors)
        return false
      }

      await this.updateStepProgress(job, 'setup_gitops', 80, '配置 Flux CD...')
      await job.log(
        `✅ GitOps 资源创建成功: ${result.namespaces.length} namespaces, ${result.gitRepositories.length} repos, ${result.kustomizations.length} kustomizations`,
      )
      this.logger.info('GitOps resources created successfully:', result)

      return true
    } catch (error) {
      this.logger.error('Failed to create GitOps resources:', error)
      // GitOps 资源创建失败不应该导致整个流程失败
      return false
    }
  }
}
