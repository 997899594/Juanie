/**
 * 项目初始化服务（重构版）
 *
 * 设计原则：
 * 1. 利用 BullMQ Job Progress - 不自建进度管理
 * 2. 利用 Redis Pub/Sub - 实时推送进度
 * 3. 利用 EventEmitter2 - 发布领域事件
 * 4. 简单线性流程 - 不需要状态机
 *
 * @packageDocumentation
 */

import { DATABASE, REDIS } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { GitConnectionsService, GitProviderService } from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type Redis from 'ioredis'
import { PinoLogger } from 'nestjs-pino'
// TODO: Re-enable when FluxResourcesService is available
// import { FluxResourcesService } from '../../gitops/flux/flux-resources.service'
// TODO: Fix import path for TemplateRenderer
// import { TemplateRenderer } from '../template-renderer.service'
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
}

/**
 * 步骤定义
 */
interface Step {
  name: string
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
    // TODO: Re-enable when FluxResourcesService is available
    // private readonly fluxResources: FluxResourcesService,
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
        { name: 'resolve_credentials', weight: 5, execute: this.resolveCredentials.bind(this) },
        { name: 'create_repository', weight: 20, execute: this.createRepository.bind(this) },
        { name: 'push_template', weight: 30, execute: this.pushTemplate.bind(this) },
        { name: 'create_db_records', weight: 10, execute: this.createDatabaseRecords.bind(this) },
        { name: 'setup_gitops', weight: 30, execute: this.setupGitOps.bind(this) },
        { name: 'finalize', weight: 5, execute: this.finalize.bind(this) },
      ]

      // 执行步骤
      let completedWeight = 0
      const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0)

      for (const step of steps) {
        await this.executeStep(ctx, step, completedWeight, totalWeight)
        completedWeight += step.weight
      }

      // 发布完成事件
      await this.publishEvent(ctx, 'initialization.completed', {
        projectId: ctx.projectId,
        duration: Date.now() - ctx.job.timestamp,
      })

      this.logger.info(`Initialization completed for project ${ctx.projectId}`)
    } catch (error) {
      this.logger.error(`Initialization failed for project ${ctx.projectId}:`, error)

      // 发布失败事件
      await this.publishEvent(ctx, 'initialization.failed', {
        projectId: ctx.projectId,
        error: error instanceof Error ? error.message : String(error),
      })

      // 更新项目状态
      await this.db
        .update(schema.projects)
        .set({
          status: 'failed',
          initializationError: error instanceof Error ? error.message : '初始化失败',
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, ctx.projectId))

      throw error
    }
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

    // 步骤开始进度
    const startProgress = Math.floor((completedWeight / totalWeight) * 100)
    await this.updateProgress(ctx, startProgress, `开始: ${step.name}`)

    try {
      // 执行步骤（带子进度追踪）
      await step.execute(ctx)

      // 步骤完成进度
      const endProgress = Math.floor(((completedWeight + step.weight) / totalWeight) * 100)
      await this.updateProgress(ctx, endProgress, `完成: ${step.name}`)
    } catch (error) {
      this.logger.error(`Step ${step.name} failed:`, error)
      throw error
    }
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
    payload: Record<string, any>,
  ): Promise<void> {
    // 1. 发布到 EventEmitter2（进程内事件）
    this.eventEmitter.emit(eventName, payload)

    // 2. 发布到 Redis Pub/Sub（跨进程事件）
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

      // 将解析后的配置存储到 context（避免重复解析）
      ;(ctx as any).resolvedRepository = resolvedConfig

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
      const resolved = (ctx as any).resolvedRepository

      await this.updateProgress(ctx, 10, `创建仓库: ${resolved.name}`, {
        name: 'create_repo',
        progress: 0,
      })

      const repoInfo = await this.gitProvider.createRepository(
        resolved.provider,
        resolved.accessToken,
        {
          name: resolved.name,
          visibility: resolved.visibility,
          defaultBranch: resolved.defaultBranch || 'main',
          autoInit: true,
        },
      )

      // 存储仓库信息
      ;(ctx as any).repoInfo = repoInfo

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
      const resolved = (ctx as any).resolvedRepository
      const repoInfo = (ctx as any).repoInfo

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
        githubUsername: resolved.username || 'unknown',
        appName: project.slug,
        registry: 'ghcr.io',
        port: 3000,
        replicas: 1,
        repository: {
          url: repoInfo.cloneUrl,
          branch: repoInfo.defaultBranch,
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
        resolved.provider,
        resolved.accessToken,
        repoInfo.fullName,
        files,
        repoInfo.defaultBranch,
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
   * 步骤 4: 创建数据库记录
   */
  private async createDatabaseRecords(ctx: InitializationContext): Promise<void> {
    try {
      const resolved = (ctx as any).resolvedRepository
      const repoInfo = (ctx as any).repoInfo

      await this.updateProgress(ctx, 60, '创建仓库记录...')

      const [repository] = await this.db
        .insert(schema.repositories)
        .values({
          projectId: ctx.projectId,
          provider: resolved.provider,
          fullName: repoInfo.fullName,
          cloneUrl: repoInfo.cloneUrl,
          defaultBranch: repoInfo.defaultBranch,
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
      ;(ctx as any).repositoryId = repository.id

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
   * 步骤 5: 设置 GitOps
   */
  private async setupGitOps(ctx: InitializationContext): Promise<void> {
    try {
      // 获取环境信息
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, ctx.projectId))

      await this.updateProgress(ctx, 70, '创建 GitOps 资源...', {
        name: 'create_gitops',
        progress: 0,
      })

      try {
        // TODO: Re-enable when FluxResourcesService is available
        // const result = await this.fluxResources.setupProjectGitOps({
        //   projectId: ctx.projectId,
        //   repositoryId,
        //   repositoryUrl: repoInfo.cloneUrl,
        //   repositoryBranch: repoInfo.defaultBranch,
        //   userId: ctx.userId,
        //   environments: environments.map((env) => ({
        //     id: env.id,
        //     type: env.type as 'development' | 'staging' | 'production',
        //     name: env.name,
        //   })),
        // })

        // Temporary: Skip GitOps setup
        this.logger.warn('FluxResourcesService not available, skipping GitOps setup')
        const result = { success: false }

        if (result.success) {
          await this.updateProgress(ctx, 90, `GitOps 资源创建成功: ${environments.length} 个环境`, {
            name: 'create_gitops',
            progress: 100,
          })
        } else {
          await this.updateProgress(ctx, 90, 'GitOps 资源创建跳过（Flux 未安装）', {
            name: 'create_gitops',
            progress: 100,
          })
        }
      } catch (error) {
        this.logger.warn('GitOps setup failed, continuing...', error)
        await this.updateProgress(ctx, 90, 'GitOps 资源创建失败，已跳过', {
          name: 'create_gitops',
          progress: 100,
        })
      }
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      // GitOps 失败不应该阻止初始化流程，所以只记录日志
      this.logger.warn({ error, ctx }, 'GitOps setup encountered an error, continuing...')
      await this.updateProgress(ctx, 90, 'GitOps 资源创建遇到错误，已跳过', {
        name: 'create_gitops',
        progress: 100,
      })
    }
  }

  /**
   * 步骤 6: 完成初始化
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
