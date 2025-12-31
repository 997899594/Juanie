/**
 * 项目初始化服务（持久化版）
 *
 * 设计原则：
 * 1. 持久化步骤状态 - 支持页面刷新恢复
 * 2. 利用 Redis Pub/Sub - 实时推送进度
 * 3. 利用 EventEmitter2 - 发布领域事件
 * 4. 简单线性流程 - 不需要状态机
 * 5. 完整审计追踪 - 记录每个步骤的详细信息
 *
 * @packageDocumentation
 */

import { DATABASE, REDIS } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { GitConnectionsService, GitProviderService } from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Job } from 'bullmq'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type Redis from 'ioredis'
import { PinoLogger } from 'nestjs-pino'
import { EnvironmentsService } from '../../environments/environments.service'
import { FluxResourcesService } from '../../gitops/flux/flux-resources.service'
import { TemplateRenderer } from '../templates/template-renderer.service'
import { InitializationOperationError, TemplateRenderError } from './initialization-errors'

/**
 * 初始化上下文
 */
export interface InitializationContext {
  // 基础信息
  projectId: string
  userId: string
  organizationId: string

  // 仓库配置
  repository: {
    provider: 'github' | 'gitlab'
    name: string
    visibility: 'public' | 'private'
    defaultBranch?: string
  }

  // 环境 IDs
  environmentIds: string[]

  // BullMQ Job（用于进度追踪）
  job: Job

  // 解析后的仓库配置（步骤1填充）
  resolvedRepository?: {
    provider: 'github' | 'gitlab'
    name: string
    visibility: 'public' | 'private'
    defaultBranch: string
    accessToken: string
    username: string
  }

  // 创建的仓库信息（步骤2填充）
  repoInfo?: {
    fullName: string
    cloneUrl: string
    defaultBranch: string
  }

  // 仓库数据库 ID（步骤4填充）
  repositoryId?: string
}

/**
 * 步骤定义
 */
interface Step {
  name: string
  displayName: string // 显示名称
  weight: number // 权重（用于计算总进度）
  execute: (ctx: InitializationContext) => Promise<void>
}

/**
 * 项目初始化服务
 *
 * 核心职责：
 * 1. 执行初始化流程（线性步骤）
 * 2. 实时推送进度（BullMQ + Redis Pub/Sub）
 * 3. 发布领域事件（EventEmitter2）
 */
@Injectable()
export class ProjectInitializationService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private redis: Redis,
    private readonly gitConnections: GitConnectionsService,
    private readonly gitProvider: GitProviderService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly environments: EnvironmentsService,
    private readonly fluxResources: FluxResourcesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectInitializationService.name)
  }

  /**
   * 执行初始化流程
   *
   * 这是唯一的公开方法，执行完整的初始化流程
   */
  async initialize(ctx: InitializationContext): Promise<void> {
    this.logger.info(`Starting initialization for project ${ctx.projectId}`)

    try {
      // 发布开始事件
      await this.publishEvent(ctx, 'initialization.started', { projectId: ctx.projectId })

      // 定义步骤（线性流程）
      const steps: Step[] = [
        {
          name: 'resolve_credentials',
          displayName: '解析凭证',
          weight: 5,
          execute: this.resolveCredentials.bind(this),
        },
        {
          name: 'create_repository',
          displayName: '创建 Git 仓库',
          weight: 15,
          execute: this.createRepository.bind(this),
        },
        {
          name: 'push_template',
          displayName: '推送项目模板',
          weight: 25,
          execute: this.pushTemplate.bind(this),
        },
        {
          name: 'create_environments',
          displayName: '创建环境',
          weight: 10,
          execute: this.createEnvironments.bind(this),
        },
        {
          name: 'create_db_records',
          displayName: '创建数据库记录',
          weight: 10,
          execute: this.createDatabaseRecords.bind(this),
        },
        {
          name: 'setup_gitops',
          displayName: '配置 GitOps',
          weight: 30,
          execute: this.setupGitOps.bind(this),
        },
        {
          name: 'finalize',
          displayName: '完成初始化',
          weight: 5,
          execute: this.finalize.bind(this),
        },
      ]

      // ✅ 批量初始化步骤到数据库
      await this.initializeStepsInDatabase(ctx, steps)

      // 执行步骤
      let completedWeight = 0
      const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0)

      for (const step of steps) {
        try {
          await this.executeStep(ctx, step, completedWeight, totalWeight)
        } catch (error) {
          // 标记步骤为失败
          await this.markStepFailed(ctx, step.name, error as Error)
          throw error // 重新抛出错误，终止流程
        }

        completedWeight += step.weight
      }

      // 更新项目状态为完成
      await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          initializationCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, ctx.projectId))

      // 发布完成事件
      await this.publishEvent(ctx, 'initialization.completed', {
        projectId: ctx.projectId,
      })

      this.logger.info(`Initialization completed for project ${ctx.projectId}`)
    } catch (error) {
      this.logger.error(`Initialization failed for project ${ctx.projectId}:`, error)

      // 更新项目状态为失败
      await this.db
        .update(schema.projects)
        .set({
          status: 'failed',
          initializationError: error instanceof Error ? error.message : '初始化失败',
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, ctx.projectId))

      // 发布失败事件
      await this.publishEvent(ctx, 'initialization.failed', {
        projectId: ctx.projectId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * 批量初始化步骤到数据库
   */
  private async initializeStepsInDatabase(
    ctx: InitializationContext,
    steps: Step[],
  ): Promise<void> {
    const stepRecords: Array<typeof schema.projectInitializationSteps.$inferInsert> = steps.map(
      (step, index) => ({
        projectId: ctx.projectId,
        step: step.name,
        displayName: step.displayName,
        sequence: index + 1,
        status: 'pending',
        progress: 0,
      }),
    )

    await this.db.insert(schema.projectInitializationSteps).values(stepRecords)
    this.logger.debug(`Initialized ${steps.length} steps in database for project ${ctx.projectId}`)
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    ctx: InitializationContext,
    step: Step,
    completedWeight: number,
    totalWeight: number,
  ): Promise<void> {
    this.logger.info(`Executing step: ${step.name}`)

    // 标记步骤为运行中
    await this.updateStepStatus(ctx, step.name, 'running', 0)

    // 步骤开始进度
    const startProgress = Math.floor((completedWeight / totalWeight) * 100)
    await this.updateProgress(ctx, startProgress, `开始: ${step.displayName}`)

    try {
      // 执行步骤（带子进度追踪）
      await step.execute(ctx)

      // 步骤完成进度
      const endProgress = Math.floor(((completedWeight + step.weight) / totalWeight) * 100)
      await this.updateProgress(ctx, endProgress, `完成: ${step.displayName}`)

      // 标记步骤为完成
      await this.updateStepStatus(ctx, step.name, 'completed', 100)
    } catch (error) {
      this.logger.error(`Step ${step.name} failed:`, error)
      throw error
    }
  }

  /**
   * 更新步骤状态到数据库
   */
  private async updateStepStatus(
    ctx: InitializationContext,
    stepName: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    progress: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date()
    const updateData: {
      status: string
      progress: number
      updatedAt: Date
      startedAt?: Date
      completedAt?: Date
      duration?: number
      metadata?: Record<string, unknown>
    } = {
      status,
      progress,
      updatedAt: now,
    }

    if (status === 'running') {
      updateData.startedAt = now
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = now

      const [step] = await this.db
        .select()
        .from(schema.projectInitializationSteps)
        .where(
          and(
            eq(schema.projectInitializationSteps.projectId, ctx.projectId),
            eq(schema.projectInitializationSteps.step, stepName),
          ),
        )
        .limit(1)

      if (step?.startedAt) {
        updateData.duration = now.getTime() - new Date(step.startedAt).getTime()
      }
    }

    if (metadata) {
      updateData.metadata = metadata
    }

    await this.db
      .update(schema.projectInitializationSteps)
      .set(updateData)
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, ctx.projectId),
          eq(schema.projectInitializationSteps.step, stepName),
        ),
      )

    this.logger.debug(`Updated step ${stepName} status to ${status}`)
  }

  /**
   * 标记步骤为失败
   */
  private async markStepFailed(
    ctx: InitializationContext,
    stepName: string,
    error: Error,
  ): Promise<void> {
    await this.db
      .update(schema.projectInitializationSteps)
      .set({
        status: 'failed',
        error: error.message,
        errorStack: error.stack,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, ctx.projectId),
          eq(schema.projectInitializationSteps.step, stepName),
        ),
      )
  }

  /**
   * 更新进度
   *
   * 利用 BullMQ Job Progress + Redis Pub/Sub 实现实时推送
   */
  private async updateProgress(
    ctx: InitializationContext,
    progress: number,
    message: string,
    substep?: { name: string; progress: number },
  ): Promise<void> {
    // 1. 更新 BullMQ Job Progress（BullMQ 内置功能）
    await ctx.job.updateProgress(progress)
    await ctx.job.log(`[${progress}%] ${message}`)

    // 2. 发布到 Redis Pub/Sub（实时推送到前端）
    const event = {
      type: 'progress',
      projectId: ctx.projectId,
      progress,
      message,
      substep,
      timestamp: Date.now(),
    }

    await this.redis.publish(`project:${ctx.projectId}`, JSON.stringify(event))

    this.logger.debug(`Progress: ${progress}% - ${message}`)
  }

  /**
   * 发布领域事件
   *
   * 利用 EventEmitter2 发布事件，其他模块可以订阅
   */
  private async publishEvent(
    ctx: InitializationContext,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.eventEmitter.emit(eventName, payload)

    const event = {
      type: eventName,
      projectId: ctx.projectId,
      ...payload,
      timestamp: Date.now(),
    }

    await this.redis.publish(`project:${ctx.projectId}`, JSON.stringify(event))

    this.logger.debug(`Event published: ${eventName}`)
  }

  // ==================== 步骤实现 ====================

  /**
   * 步骤 1: 解析凭证
   */
  private async resolveCredentials(ctx: InitializationContext): Promise<void> {
    try {
      await this.updateProgress(ctx, 2, '解析 OAuth 凭证...')

      const resolvedConfig = await this.gitConnections.resolveRepositoryConfig(
        ctx.userId,
        ctx.repository,
      )

      // 将解析后的配置存储到 context
      ctx.resolvedRepository = resolvedConfig

      await this.updateProgress(ctx, 5, `凭证解析完成: ${resolvedConfig.username}`)
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      this.logger.error({ error, ctx }, 'Failed to resolve credentials')
      throw new InitializationOperationError('resolve_credentials', ctx.projectId, error as Error)
    }
  }

  /**
   * 步骤 2: 创建 Git 仓库
   */
  private async createRepository(ctx: InitializationContext): Promise<void> {
    try {
      if (!ctx.resolvedRepository) {
        throw new Error('Resolved repository config not found')
      }

      await this.updateProgress(ctx, 10, `创建仓库: ${ctx.resolvedRepository.name}`, {
        name: 'create_repo',
        progress: 0,
      })

      const repoInfo = await this.gitProvider.createRepository(
        ctx.resolvedRepository.provider,
        ctx.resolvedRepository.accessToken,
        {
          name: ctx.resolvedRepository.name,
          visibility: ctx.resolvedRepository.visibility,
          defaultBranch: ctx.resolvedRepository.defaultBranch || 'main',
          autoInit: true,
        },
      )

      // 存储仓库信息
      ctx.repoInfo = repoInfo

      await this.updateProgress(ctx, 25, `仓库创建成功: ${repoInfo.fullName}`, {
        name: 'create_repo',
        progress: 100,
      })
    } catch (error) {
      // ✅ SDK 错误会被 GitProviderService 包装，直接传递
      this.logger.error({ error, ctx }, 'Failed to create repository')
      throw new InitializationOperationError('create_repository', ctx.projectId, error as Error)
    }
  }

  /**
   * 步骤 3: 推送模板代码
   */
  private async pushTemplate(ctx: InitializationContext): Promise<void> {
    try {
      if (!ctx.resolvedRepository || !ctx.repoInfo) {
        throw new Error('Repository config or info not found')
      }

      // 获取项目信息
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, ctx.projectId))
        .limit(1)

      if (!project) {
        throw new InitializationOperationError(
          'push_template',
          ctx.projectId,
          new Error('Project not found'),
        )
      }

      // 子步骤 1: 准备变量
      await this.updateProgress(ctx, 30, '准备模板变量...', {
        name: 'prepare_vars',
        progress: 0,
      })

      const templateVariables = {
        projectId: project.id,
        projectName: project.name,
        projectSlug: project.slug,
        description: project.description || `${project.name} - AI DevOps Platform`,
        githubUsername: ctx.resolvedRepository.username || 'unknown',
        appName: project.slug,
        registry: 'ghcr.io',
        port: 3000,
        replicas: 1,
        platformApiUrl: process.env.PLATFORM_API_URL || 'http://localhost:3000', // ✅ 添加平台 API URL
        repository: {
          url: ctx.repoInfo.cloneUrl,
          branch: ctx.repoInfo.defaultBranch,
        },
      }

      await this.updateProgress(ctx, 35, '模板变量准备完成', {
        name: 'prepare_vars',
        progress: 100,
      })

      // 子步骤 2: 渲染模板
      await this.updateProgress(ctx, 40, '渲染模板文件...', {
        name: 'render_template',
        progress: 0,
      })

      let files: Array<{ path: string; content: string }>
      try {
        files = await this.templateRenderer.renderTemplateToMemory(
          'nextjs-15-app',
          templateVariables,
        )
      } catch (error) {
        throw new TemplateRenderError('nextjs-15-app', error as Error)
      }

      await this.updateProgress(ctx, 45, `已渲染 ${files.length} 个文件`, {
        name: 'render_template',
        progress: 100,
      })

      // 子步骤 3: 推送文件
      await this.updateProgress(ctx, 50, `推送 ${files.length} 个文件到仓库...`, {
        name: 'push_files',
        progress: 0,
      })

      await this.gitProvider.pushFiles(
        ctx.resolvedRepository.provider,
        ctx.resolvedRepository.accessToken,
        ctx.repoInfo.fullName,
        files,
        ctx.repoInfo.defaultBranch,
        `Initial commit: Add ${files.length} project files`,
      )

      await this.updateProgress(ctx, 55, '代码推送完成，镜像构建将自动开始', {
        name: 'push_files',
        progress: 100,
      })
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof TemplateRenderError || error instanceof InitializationOperationError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, ctx }, 'Failed to push template')
      throw new InitializationOperationError('push_template', ctx.projectId, error as Error)
    }
  }

  /**
   * 步骤 4: 创建环境
   */
  private async createEnvironments(ctx: InitializationContext): Promise<void> {
    try {
      await this.updateProgress(ctx, 50, '创建默认环境...')

      // 创建三个默认环境：development, staging, production
      const defaultEnvironments = [
        {
          name: 'Development',
          type: 'development' as const,
          status: 'active' as const,
          config: {
            approvalRequired: false,
            minApprovals: 1,
          },
        },
        {
          name: 'Staging',
          type: 'staging' as const,
          status: 'active' as const,
          config: {
            approvalRequired: true,
            minApprovals: 1,
          },
        },
        {
          name: 'Production',
          type: 'production' as const,
          status: 'active' as const,
          config: {
            approvalRequired: true,
            minApprovals: 2,
          },
        },
      ]

      const createdEnvironments: string[] = []

      for (const envConfig of defaultEnvironments) {
        const environment = await this.environments.create(ctx.userId, {
          projectId: ctx.projectId,
          name: envConfig.name,
          type: envConfig.type,
          status: envConfig.status,
          config: envConfig.config,
        })

        if (environment) {
          createdEnvironments.push(environment.id)
          this.logger.debug(`Created environment: ${environment.name} (${environment.id})`)
        }
      }

      // 更新 context 中的环境 IDs
      ctx.environmentIds = createdEnvironments

      await this.updateProgress(ctx, 55, `已创建 ${createdEnvironments.length} 个环境`)
    } catch (error) {
      this.logger.error({ error, ctx }, 'Failed to create environments')
      throw new InitializationOperationError('create_environments', ctx.projectId, error as Error)
    }
  }

  /**
   * 步骤 5: 创建数据库记录
   */
  private async createDatabaseRecords(ctx: InitializationContext): Promise<void> {
    try {
      if (!ctx.resolvedRepository || !ctx.repoInfo) {
        throw new Error('Repository config or info not found')
      }

      await this.updateProgress(ctx, 60, '创建仓库记录...')

      const [repository] = await this.db
        .insert(schema.repositories)
        .values({
          projectId: ctx.projectId,
          provider: ctx.resolvedRepository.provider,
          fullName: ctx.repoInfo.fullName,
          cloneUrl: ctx.repoInfo.cloneUrl,
          defaultBranch: ctx.repoInfo.defaultBranch,
          status: 'success',
          lastSyncAt: new Date(),
        })
        .returning()

      if (!repository) {
        throw new InitializationOperationError(
          'create_db_records',
          ctx.projectId,
          new Error('Failed to create repository record'),
        )
      }

      // 存储仓库 ID
      ctx.repositoryId = repository.id

      await this.updateProgress(ctx, 65, '数据库记录已创建')
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof InitializationOperationError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, ctx }, 'Failed to create database records')
      throw new InitializationOperationError('create_db_records', ctx.projectId, error as Error)
    }
  }

  /**
   * 步骤 6: 设置 GitOps
   */
  private async setupGitOps(ctx: InitializationContext): Promise<void> {
    await this.updateProgress(ctx, 70, '创建 GitOps 资源...', {
      name: 'create_gitops',
      progress: 0,
    })

    try {
      // 获取已创建的环境
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, ctx.projectId))

      if (environments.length === 0) {
        this.logger.warn(
          `No environments found for project ${ctx.projectId}, skipping GitOps setup`,
        )
        await this.updateProgress(ctx, 90, 'GitOps 资源创建跳过（无环境）', {
          name: 'create_gitops',
          progress: 100,
        })
        return
      }

      // 使用 FluxResourcesService 创建 GitOps 资源
      const result = await this.fluxResources.setupProjectGitOps({
        projectId: ctx.projectId,
        repositoryId: ctx.repositoryId!,
        repositoryUrl: ctx.repoInfo!.cloneUrl,
        repositoryBranch: ctx.repoInfo!.defaultBranch,
        userId: ctx.userId,
        environments: environments.map((env) => ({
          id: env.id,
          type: env.type as 'development' | 'staging' | 'production' | 'testing',
          name: env.name,
        })),
        gitToken: ctx.resolvedRepository?.accessToken,
      })

      await this.updateProgress(
        ctx,
        90,
        `GitOps 资源已创建: 1 GitRepository + ${result.kustomizations.length} Kustomizations`,
        {
          name: 'create_gitops',
          progress: 100,
        },
      )

      this.logger.info(
        `✅ Created GitOps resources for project ${ctx.projectId}: ${result.gitRepository.name}`,
      )
    } catch (error) {
      // 如果 K8s 未连接，记录警告但不失败
      if (!this.fluxResources['k8sClient'].isK8sConnected()) {
        this.logger.warn('K8s not connected, skipping GitOps setup')
        await this.updateProgress(ctx, 90, 'GitOps 资源创建跳过（K8s 未连接）', {
          name: 'create_gitops',
          progress: 100,
        })
        return
      }

      // 其他错误抛出
      this.logger.error({ error, ctx }, 'Failed to setup GitOps')
      throw new InitializationOperationError('setup_gitops', ctx.projectId, error as Error)
    }
  }

  /**
   * 步骤 7: 完成初始化
   */
  private async finalize(ctx: InitializationContext): Promise<void> {
    try {
      await this.updateProgress(ctx, 95, '更新项目状态...')

      await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          initializationCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, ctx.projectId))

      await this.updateProgress(ctx, 100, '项目初始化完成！')
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      this.logger.error({ error, ctx }, 'Failed to finalize initialization')
      throw new InitializationOperationError('finalize', ctx.projectId, error as Error)
    }
  }
}
