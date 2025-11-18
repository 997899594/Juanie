import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import {
  DEPLOYMENT_QUEUE,
  PROJECT_INITIALIZATION_QUEUE,
  REPOSITORY_QUEUE,
} from '@juanie/core-queue'
import { EventBusService } from '@juanie/core-sse'
import { DATABASE, REDIS } from '@juanie/core-tokens'
import type {
  CreateProjectWithTemplateInput,
  DeploymentCompletedEvent,
  EnvironmentUpdatedEvent,
  GitOpsSyncStatusEvent,
  InitializationResult,
  ProjectEvent,
  ProjectHealth,
  ProjectStatus,
} from '@juanie/core-types'
import { AuditLogsService } from '@juanie/service-audit-logs'
import { OAuthAccountsService } from '@juanie/service-auth'
import { EnvironmentsService } from '@juanie/service-environments'
import { FluxService } from '@juanie/service-flux'
import { GitProviderService } from '@juanie/service-git-providers'
import { NotificationsService } from '@juanie/service-notifications'
import { RepositoriesService } from '@juanie/service-repositories'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type Redis from 'ioredis'
import { TemplateManager } from './template-manager.service'

/**
 * ProjectOrchestrator 服务
 *
 * 职责：编排项目的完整生命周期，协调其他服务
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
@Injectable()
export class ProjectOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(ProjectOrchestrator.name)
  private subscriber!: Redis // 独立的订阅连接

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(DEPLOYMENT_QUEUE) private queue: Queue,
    @Inject(REPOSITORY_QUEUE) private repositoryQueue: Queue,
    @Inject(PROJECT_INITIALIZATION_QUEUE) private projectInitQueue: Queue,
    @Inject(REDIS) private redis: Redis,
    private environments: EnvironmentsService,
    private repositories: RepositoriesService,
    private flux: FluxService,
    private templates: TemplateManager,
    private audit: AuditLogsService,
    private notifications: NotificationsService,
    private oauthAccounts: OAuthAccountsService,
    private gitProvider: GitProviderService,
    public eventBus: EventBusService, // 公开以供 ProjectsService 访问
  ) {}

  onModuleInit() {
    // 为订阅创建独立的 Redis 连接
    // 避免与普通命令冲突（订阅模式下不能执行普通命令）
    this.subscriber = this.redis.duplicate()

    // 订阅相关事件
    this.subscribeToEvents()
  }

  /**
   * 创建项目并初始化所有资源
   * Requirements: 1.1, 1.2, 1.5
   */
  @Trace('project-orchestrator.createAndInitialize')
  async createAndInitialize(
    userId: string,
    data: CreateProjectWithTemplateInput,
  ): Promise<typeof schema.projects.$inferSelect & { jobIds?: string[] }> {
    this.logger.log(`Creating project: ${data.name}`)

    // 1. 创建项目记录
    const project = await this.createProjectRecord(userId, data)

    try {
      // 2. 发布 project.created 事件
      await this.publishEvent({
        type: 'project.created',
        projectId: project.id,
        organizationId: project.organizationId,
        templateId: data.templateId,
        createdBy: userId,
        timestamp: new Date(),
      })

      // 3. 记录审计日志
      await this.audit.log({
        userId,
        organizationId: project.organizationId,
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
        metadata: {
          name: project.name,
          slug: project.slug,
          templateId: data.templateId,
        },
      })

      // 4. 根据配置决定初始化路径
      const hasTemplate = !!data.templateId
      const hasRepository = !!data.repository

      this.logger.log(`Initialization path: template=${hasTemplate}, repository=${hasRepository}`)

      let jobIds: string[] | undefined

      if (hasTemplate) {
        // 路径 A: 使用模板初始化（可能包含仓库）
        const result = await this.initializeFromTemplate(
          userId,
          project.id,
          project.organizationId,
          data.templateId!,
          {
            repository: data.repository,
            templateConfig: data.templateConfig,
          },
        )
        jobIds = result.jobIds
      } else if (hasRepository) {
        // 路径 B: 无模板但有仓库
        await this.initializeWithRepository(
          userId,
          project.id,
          project.organizationId,
          data.repository!,
        )
      } else {
        // 路径 C: 空项目（仍需创建默认环境）
        await this.initializeEmptyProject(userId, project.id)
      }

      return { ...project, jobIds }
    } catch (error) {
      // 统一错误处理
      await this.handleInitializationError(project.id, error as Error, userId)
      throw error
    }
  }

  /**
   * 从模板初始化项目
   * Requirements: 1.1, 1.2, 1.3
   */
  @Trace('project-orchestrator.initializeFromTemplate')
  async initializeFromTemplate(
    userId: string,
    projectId: string,
    organizationId: string,
    templateId: string,
    config: {
      repository?: CreateProjectWithTemplateInput['repository']
      templateConfig?: Record<string, any>
    },
  ): Promise<InitializationResult> {
    this.logger.log(`Initializing project ${projectId} from template ${templateId}`)

    const createdResources: InitializationResult['createdResources'] = {
      environments: [],
      repositories: [],
      gitopsResources: [],
    }
    const jobIds: string[] = [] // 跟踪异步任务 ID

    try {
      // 1. 获取模板配置
      const template = await this.templates.getTemplate(templateId)
      if (!template) {
        throw new Error(`模板 ${templateId} 不存在`)
      }

      await this.updateInitializationStatus(projectId, {
        step: 'load_template',
        progress: 20,
        completedSteps: ['create_project'],
      })

      // 2. 创建环境（development, staging, production）- 并行创建
      this.logger.log(`Creating environments for project ${projectId}`)
      const environmentTypes: Array<'development' | 'staging' | 'production'> = [
        'development',
        'staging',
        'production',
      ]

      const environmentPromises = environmentTypes.map(async (envType) => {
        const envTemplate = template.defaultConfig.environments.find((e) => e.type === envType)
        const fallbackName =
          envType === 'development'
            ? 'Development'
            : envType === 'staging'
              ? 'Staging'
              : 'Production'

        const environment = await this.environments.create(userId, {
          projectId,
          name: envTemplate?.name ?? fallbackName,
          type: envType,
          config: {
            approvalRequired: envType === 'production',
            minApprovals: envType === 'production' ? 1 : 0,
          },
        })

        if (environment) {
          this.logger.log(`Created environment: ${environment.name} (${environment.id})`)
          return environment.id
        }
        return null
      })

      const environmentIds = (await Promise.all(environmentPromises)).filter(
        (id): id is string => id !== null,
      )
      createdResources.environments.push(...environmentIds)

      await this.updateInitializationStatus(projectId, {
        step: 'create_environments',
        progress: 40,
        completedSteps: ['create_project', 'load_template'],
      })

      // 3. 处理 Git 仓库
      if (config.repository) {
        this.logger.log(`Processing repository for project ${projectId}`)
        this.logger.log(`Repository config: ${JSON.stringify(config.repository)}`)

        // 区分快速路径和慢速路径
        if (config.repository.mode === 'existing') {
          // 快速路径也需要解析 token，但这是必要的同步操作
          const repositoryConfig = await this.resolveAccessToken(userId, config.repository)
          this.logger.log(
            `Resolved repository config: ${JSON.stringify({ ...repositoryConfig, accessToken: '***' })}`,
          )
          // 快速路径：关联现有仓库（同步，很快）
          const repository = await this.connectExistingRepository(
            userId,
            projectId,
            repositoryConfig as Extract<typeof repositoryConfig, { mode: 'existing' }>,
          )
          this.logger.log(`Repository connected: ${repository.id}`)
          createdResources.repositories.push(repository.id)

          await this.updateInitializationStatus(projectId, {
            step: 'setup_repository',
            progress: 60,
            completedSteps: ['create_project', 'load_template', 'create_environments'],
          })

          // 创建 GitOps 资源
          this.logger.log(`Creating GitOps resources for project ${projectId}`)
          const environments = await this.environments.list(userId, projectId)

          for (const environment of environments) {
            try {
              const gitopsResource = await this.flux.createGitOpsResource({
                projectId,
                environmentId: environment.id,
                repositoryId: repository.id,
                type: 'kustomization',
                name: `${projectId}-${environment.type}`,
                namespace: 'default',
                config: {
                  gitRepositoryName: repository.fullName,
                  path: `k8s/overlays/${environment.type}`,
                  interval: '5m',
                  prune: true,
                  timeout: '2m',
                },
              })

              createdResources.gitopsResources.push(gitopsResource.id)
              this.logger.log(`Created GitOps resource for environment: ${environment.type}`)
            } catch (error) {
              this.logger.error(
                `Failed to create GitOps resource for environment ${environment.type}:`,
                error,
              )
              // 继续创建其他环境的资源
            }
          }

          await this.updateInitializationStatus(projectId, {
            step: 'create_gitops_resources',
            progress: 80,
            completedSteps: [
              'create_project',
              'load_template',
              'create_environments',
              'setup_repository',
            ],
          })
        } else {
          // 慢速路径：创建新仓库（异步）
          // 不在这里解析 token，让 worker 去做
          // 传递已知的信息，避免重复查询
          const { jobId, repositoryName } = await this.createNewRepositoryAndConnect(
            userId,
            projectId,
            organizationId,
            createdResources.environments, // 传递已创建的环境 ID
            config.repository,
          )

          jobIds.push(jobId) // 保存 jobId 供前端 SSE 监听
          this.logger.log(`Repository creation queued: ${repositoryName} (job: ${jobId})`)

          // 更新项目状态，标记为等待仓库创建，并保存 jobId
          await this.db
            .update(schema.projects)
            .set({
              status: 'initializing',
              initializationStatus: {
                step: 'creating_repository',
                progress: 50,
                completedSteps: ['create_project', 'load_template', 'create_environments'],
                jobId, // 保存 jobId 供前端 SSE 连接使用
              },
              updatedAt: new Date(),
            })
            .where(eq(schema.projects.id, projectId))

          // 注意：后续的 K8s 配置和 GitOps 资源创建将在 worker 完成后通过事件触发
          // 这里不再继续执行，避免阻塞
          this.logger.log(
            `Project ${projectId} initialization will continue after repository creation`,
          )

          // 早期返回，避免执行后面的状态更新
          return {
            success: true,
            projectId,
            createdResources,
            jobIds: [jobId],
          }
        }
      }

      // 6. 更新项目状态为 active（只有快速路径会到这里）
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
              'setup_repository',
              'create_gitops_resources',
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      // 7. 发布 project.initialized 事件
      await this.publishEvent({
        type: 'project.initialized',
        projectId,
        createdResources,
        timestamp: new Date(),
      })

      // 8. 发送通知
      await this.notifications.create({
        userId,
        type: 'system',
        title: '项目初始化完成',
        message: `项目 "${projectId}" 已成功初始化`,
        priority: 'normal',
      })

      this.logger.log(`Project ${projectId} initialized successfully`)

      return {
        success: true,
        projectId,
        createdResources,
        jobIds: jobIds.length > 0 ? jobIds : undefined,
      }
    } catch (error) {
      this.logger.error(`Failed to initialize project ${projectId}:`, error)

      // 回滚已创建的资源
      await this.rollbackResources(projectId, createdResources)

      // 使用统一的错误处理方法
      await this.handleInitializationError(projectId, error as Error, userId)

      return {
        success: false,
        projectId,
        createdResources,
        errors: [error instanceof Error ? error.message : '未知错误'],
      }
    }
  }

  /**
   * 创建项目记录
   */
  private async createProjectRecord(
    userId: string,
    data: CreateProjectWithTemplateInput,
  ): Promise<typeof schema.projects.$inferSelect> {
    try {
      const [project] = await this.db
        .insert(schema.projects)
        .values({
          organizationId: data.organizationId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          logoUrl: data.logoUrl,
          visibility: data.visibility ?? 'private',
          status: 'initializing',
          templateId: data.templateId,
          templateConfig: data.templateConfig,
          initializationStatus: {
            step: 'create_project',
            progress: 10,
            completedSteps: [],
          },
          config: {
            defaultBranch: 'main',
            enableCiCd: true,
            enableAi: true,
          },
        })
        .returning()

      if (!project) {
        throw new Error('创建项目记录失败')
      }

      this.logger.log(`Project record created: ${project.id}`)
      return project
    } catch (error: any) {
      // 处理唯一约束冲突
      const pgError = error.cause || error
      const errorCode = pgError.code || error.code
      const constraintName = pgError.constraint_name || error.constraint

      if (
        errorCode === '23505' ||
        error.message?.includes('unique') ||
        error.message?.includes('duplicate')
      ) {
        if (
          error.message?.includes('slug') ||
          constraintName?.includes('slug') ||
          pgError.detail?.includes('slug')
        ) {
          throw new Error(`项目标识 "${data.slug}" 已存在，请使用其他标识`)
        }
        throw new Error('项目名称或标识已存在，请使用其他名称')
      }

      // 处理其他数据库错误
      this.logger.error('Failed to create project record:', error)
      throw new Error(`创建项目失败: ${error.message || '数据库错误'}`)
    }
  }

  /**
   * 标记项目为活跃状态
   */
  private async markAsActive(projectId: string, completedSteps: string[]): Promise<void> {
    await this.db
      .update(schema.projects)
      .set({
        status: 'active',
        initializationStatus: {
          step: 'completed',
          progress: 100,
          completedSteps,
        },
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    this.logger.log(`Project ${projectId} marked as active`)
  }

  /**
   * 统一错误处理
   * Requirements: 2.5, 4.2, 4.3
   *
   * 确保所有初始化错误都经过此方法处理，提供一致的错误处理和用户友好的错误信息
   */
  private async handleInitializationError(
    projectId: string,
    error: Error,
    userId?: string,
  ): Promise<void> {
    this.logger.error(`Initialization failed for project ${projectId}:`, {
      error: error.message,
      stack: error.stack,
      userId,
    })

    // 生成用户友好的错误信息
    const userFriendlyMessage = this.getUserFriendlyErrorMessage(error)

    try {
      // 检查项目是否有任何成功创建的资源
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      const hasResources = (project?.initializationStatus?.completedSteps?.length ?? 0) > 1 // 除了 create_project

      if (hasResources) {
        // 如果已经创建了一些资源，保留项目但标记为失败
        await this.db
          .update(schema.projects)
          .set({
            status: 'failed',
            initializationStatus: {
              step: 'failed',
              progress: 0,
              error: userFriendlyMessage,
              completedSteps: project?.initializationStatus?.completedSteps || [],
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, projectId))

        this.logger.log(`Project ${projectId} status updated to failed (resources exist)`)
      } else {
        // 如果没有创建任何资源，直接软删除项目记录，避免占用 slug
        await this.db
          .update(schema.projects)
          .set({
            deletedAt: new Date(),
            status: 'failed',
            initializationStatus: {
              step: 'failed',
              progress: 0,
              error: userFriendlyMessage,
              completedSteps: [],
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, projectId))

        this.logger.log(`Project ${projectId} soft deleted (no resources created)`)
      }
    } catch (updateError) {
      this.logger.error(`Failed to update project status for ${projectId}:`, updateError)
      // 继续执行，不要因为状态更新失败而中断错误处理
    }

    // 发送通知
    if (userId) {
      try {
        await this.notifications.create({
          userId,
          type: 'system',
          title: '项目初始化失败',
          message: userFriendlyMessage,
          priority: 'high',
        })
        this.logger.log(`Failure notification sent to user ${userId}`)
      } catch (notificationError) {
        this.logger.error(`Failed to send failure notification:`, notificationError)
        // 继续执行，不要因为通知失败而中断错误处理
      }
    }

    // 发布失败事件
    try {
      await this.publishEvent({
        type: 'project.initialization.failed',
        projectId,
        error: userFriendlyMessage,
        timestamp: new Date(),
      } as any)
    } catch (eventError) {
      this.logger.error(`Failed to publish initialization failed event:`, eventError)
      // 继续执行，不要因为事件发布失败而中断错误处理
    }
  }

  /**
   * 将技术错误信息转换为用户友好的错误信息
   * Requirements: 2.5, 4.2, 4.3
   */
  private getUserFriendlyErrorMessage(error: Error): string {
    const message = error.message

    // OAuth 相关错误
    if (message.includes('OAuth') || message.includes('令牌')) {
      if (message.includes('未找到')) {
        return '未找到 Git 账户连接。请前往"设置 > 账户连接"页面连接您的 GitHub 或 GitLab 账户，或在创建项目时手动输入访问令牌。'
      }
      if (message.includes('无效')) {
        return 'Git 访问令牌无效。请重新连接您的账户或检查手动输入的令牌是否正确。'
      }
      if (message.includes('过期')) {
        return 'Git 访问令牌已过期。请重新连接您的账户以获取新的令牌。'
      }
    }

    // 仓库相关错误
    if (message.includes('仓库')) {
      if (message.includes('不存在') || message.includes('无法访问')) {
        return '仓库不存在或无法访问。请检查仓库 URL 是否正确，以及您是否有访问权限。'
      }
      if (message.includes('已存在')) {
        return '仓库名称已存在。请使用其他名称或关联现有仓库。'
      }
      if (message.includes('URL 格式')) {
        return '仓库 URL 格式不正确。支持的格式：https://github.com/owner/repo 或 git@github.com:owner/repo.git'
      }
      if (message.includes('创建失败') || message.includes('连接失败')) {
        return `仓库操作失败: ${message}。请检查网络连接和访问权限。`
      }
    }

    // API 错误
    if (message.includes('API 错误') || message.includes('401') || message.includes('403')) {
      return '访问令牌无效或权限不足。请检查令牌权限是否包含仓库创建和管理权限。'
    }

    if (message.includes('404')) {
      return '请求的资源不存在。请检查配置是否正确。'
    }

    if (message.includes('422')) {
      return '请求参数无效。请检查输入的信息是否正确。'
    }

    // 网络错误
    if (
      message.includes('网络') ||
      message.includes('timeout') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT')
    ) {
      return '网络连接失败。请检查网络连接后重试。'
    }

    // 模板错误
    if (message.includes('模板')) {
      return `模板处理失败: ${message}。请联系管理员检查模板配置。`
    }

    // 环境错误
    if (message.includes('环境')) {
      return `环境创建失败: ${message}。请稍后重试或联系管理员。`
    }

    // GitOps 错误
    if (message.includes('GitOps') || message.includes('Flux')) {
      return `GitOps 配置失败: ${message}。请检查 Kubernetes 集群连接。`
    }

    // 权限错误
    if (message.includes('权限') || message.includes('permission')) {
      return '权限不足。请确保您有足够的权限执行此操作。'
    }

    // 默认返回原始错误信息（如果已经是用户友好的）
    // 或者添加通用前缀
    if (message.length > 100) {
      return '项目初始化失败。请稍后重试或联系管理员。'
    }

    return message
  }

  /**
   * 初始化空白项目（无模板无仓库）
   * Requirements: 1.1, 1.2
   *
   * 创建默认的 3 个环境，但不创建仓库和 GitOps 资源
   */
  @Trace('project-orchestrator.initializeEmptyProject')
  private async initializeEmptyProject(userId: string, projectId: string): Promise<void> {
    this.logger.log(`Initializing empty project ${projectId}`)

    const createdResources: InitializationResult['createdResources'] = {
      environments: [],
      repositories: [],
      gitopsResources: [],
    }

    try {
      await this.updateInitializationStatus(projectId, {
        step: 'create_environments',
        progress: 50,
        completedSteps: ['create_project'],
      })

      // 创建默认的 3 个环境
      const defaultEnvironments = [
        { name: 'Development', type: 'development' as const },
        { name: 'Staging', type: 'staging' as const },
        { name: 'Production', type: 'production' as const },
      ]

      for (const envConfig of defaultEnvironments) {
        const environment = await this.environments.create(userId, {
          projectId,
          name: envConfig.name,
          type: envConfig.type,
          config: {
            approvalRequired: envConfig.type === 'production',
            minApprovals: envConfig.type === 'production' ? 1 : 0,
          },
        })

        if (environment) {
          createdResources.environments.push(environment.id)
          this.logger.log(`Created environment: ${environment.name} (${environment.id})`)
        }
      }

      await this.markAsActive(projectId, ['create_project', 'create_environments'])

      // 发送通知
      await this.notifications.create({
        userId,
        type: 'system',
        title: '项目创建完成',
        message: `空白项目已成功创建，已为您创建 3 个默认环境`,
        priority: 'normal',
      })

      this.logger.log(`Empty project ${projectId} initialized successfully`)
    } catch (error) {
      this.logger.error(`Failed to initialize empty project ${projectId}:`, error)

      // 回滚已创建的资源
      await this.rollbackResources(projectId, createdResources)

      // 重新抛出错误，让上层的 createAndInitialize 处理
      throw error
    }
  }

  /**
   * 初始化只有仓库的项目（无模板）
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  @Trace('project-orchestrator.initializeWithRepository')
  private async initializeWithRepository(
    userId: string,
    projectId: string,
    organizationId: string,
    repositoryConfig: NonNullable<CreateProjectWithTemplateInput['repository']>,
  ): Promise<void> {
    this.logger.log(`Initializing project ${projectId} with repository only`)

    const createdResources: InitializationResult['createdResources'] = {
      environments: [],
      repositories: [],
      gitopsResources: [],
    }

    try {
      // 1. 创建默认环境
      await this.updateInitializationStatus(projectId, {
        step: 'create_environments',
        progress: 30,
        completedSteps: ['create_project'],
      })

      const defaultEnvironments = [
        { name: 'Development', type: 'development' as const },
        { name: 'Staging', type: 'staging' as const },
        { name: 'Production', type: 'production' as const },
      ]

      for (const envConfig of defaultEnvironments) {
        const environment = await this.environments.create(userId, {
          projectId,
          name: envConfig.name,
          type: envConfig.type,
          config: {
            approvalRequired: envConfig.type === 'production',
            minApprovals: envConfig.type === 'production' ? 1 : 0,
          },
        })

        if (environment) {
          createdResources.environments.push(environment.id)
          this.logger.log(`Created environment: ${environment.name} (${environment.id})`)
        }
      }

      // 2. 处理仓库
      await this.updateInitializationStatus(projectId, {
        step: 'setup_repository',
        progress: 70,
        completedSteps: ['create_project', 'create_environments'],
      })

      const resolvedConfig = await this.resolveAccessToken(userId, repositoryConfig)

      // 区分快速路径和慢速路径
      if (resolvedConfig.mode === 'existing') {
        // 快速路径：关联现有仓库
        const repository = await this.connectExistingRepository(userId, projectId, resolvedConfig)
        createdResources.repositories.push(repository.id)

        // 创建 GitOps 资源（如果 K3s 可用）
        try {
          if (this.flux.isInstalled()) {
            this.logger.log(`Creating GitOps resources for project ${projectId}`)
            const environments = await this.environments.list(userId, projectId)

            for (const environment of environments) {
              try {
                const gitopsResource = await this.flux.createGitOpsResource({
                  projectId,
                  environmentId: environment.id,
                  repositoryId: repository.id,
                  type: 'kustomization',
                  name: `${projectId}-${environment.type}`,
                  namespace: 'default',
                  config: {
                    gitRepositoryName: repository.fullName,
                    path: `k8s/overlays/${environment.type}`,
                    interval: '5m',
                    prune: true,
                    timeout: '2m',
                  },
                })

                createdResources.gitopsResources.push(gitopsResource.id)
                this.logger.log(`Created GitOps resource for environment: ${environment.type}`)
              } catch (error) {
                this.logger.error(
                  `Failed to create GitOps resource for environment ${environment.type}:`,
                  error,
                )
                // 继续创建其他环境的资源
              }
            }
          } else {
            this.logger.log(`Flux not installed, skipping GitOps resource creation`)
          }
        } catch (error) {
          this.logger.error(`Failed to create GitOps resources (non-fatal):`, error)
          // GitOps 资源创建失败不应该导致项目创建失败
        }

        await this.markAsActive(projectId, [
          'create_project',
          'create_environments',
          'setup_repository',
        ])

        // 发送通知
        await this.notifications.create({
          userId,
          type: 'system',
          title: '项目创建完成',
          message: `项目已成功创建，包含 3 个环境和关联的仓库`,
          priority: 'normal',
        })
      } else {
        // 慢速路径：创建新仓库（异步）
        const { jobId } = await this.createNewRepositoryAndConnect(
          userId,
          projectId,
          organizationId,
          createdResources.environments,
          resolvedConfig,
        )

        // 项目保持 initializing 状态，等待仓库创建完成
        await this.updateInitializationStatus(projectId, {
          step: 'creating_repository',
          progress: 50,
          completedSteps: ['create_project', 'create_environments'],
        })

        this.logger.log(
          `Project ${projectId} will be activated after repository creation (job: ${jobId})`,
        )
      }
    } catch (error) {
      this.logger.error(`Failed to initialize project ${projectId} with repository:`, error)

      // 回滚已创建的资源
      await this.rollbackResources(projectId, createdResources)

      // 重新抛出错误，让上层的 createAndInitialize 处理
      throw error
    }
  }

  /**
   * 解析访问令牌
   * 如果令牌是 __USE_OAUTH__，则从数据库获取用户的 OAuth 令牌
   */
  private async resolveAccessToken(
    userId: string,
    repositoryConfig: NonNullable<CreateProjectWithTemplateInput['repository']>,
  ): Promise<NonNullable<CreateProjectWithTemplateInput['repository']>> {
    // 如果不是使用 OAuth，直接返回
    if (repositoryConfig.accessToken !== '__USE_OAUTH__') {
      this.logger.log('Using manually provided access token')
      return repositoryConfig
    }

    this.logger.log(
      `Resolving OAuth token for user ${userId}, provider: ${repositoryConfig.provider}`,
    )

    try {
      // 从数据库获取 OAuth 账户
      const oauthAccount = await this.oauthAccounts.getAccountByProvider(
        userId,
        repositoryConfig.provider,
      )

      if (!oauthAccount) {
        const providerName = repositoryConfig.provider === 'github' ? 'GitHub' : 'GitLab'
        throw new Error(
          `未找到 ${providerName} OAuth 连接。请前往"设置 > 账户连接"页面连接您的 ${providerName} 账户，或在创建项目时手动输入访问令牌。`,
        )
      }

      if (!oauthAccount.accessToken || oauthAccount.status !== 'active') {
        const providerName = repositoryConfig.provider === 'github' ? 'GitHub' : 'GitLab'
        throw new Error(`${providerName} 访问令牌无效，请重新连接账户`)
      }

      // GitHub token 永久有效，GitLab token 已在 getAccountByProvider 中自动刷新

      return {
        ...repositoryConfig,
        accessToken: oauthAccount.accessToken,
      }
    } catch (error) {
      this.logger.error(`Failed to resolve OAuth token:`, error)
      throw error
    }
  }

  /**
   * 关联现有仓库
   * Requirements: 4.1, 4.2, 4.3
   */
  private async connectExistingRepository(
    userId: string,
    projectId: string,
    config: Extract<
      NonNullable<CreateProjectWithTemplateInput['repository']>,
      { mode: 'existing' }
    >,
  ): Promise<typeof schema.repositories.$inferSelect> {
    this.logger.log(`Connecting existing repository: ${config.url}`)

    try {
      // 解析仓库 URL
      const parsed = this.parseRepositoryUrl(config.url)
      if (!parsed) {
        throw new Error(
          '仓库 URL 格式不正确，支持的格式：https://github.com/owner/repo 或 git@github.com:owner/repo.git',
        )
      }

      // 验证仓库是否可访问（可选，但推荐）
      const validation = await this.gitProvider.validateRepository(
        config.provider,
        config.accessToken,
        parsed.fullName,
      )

      if (!validation.valid) {
        throw new Error(validation.error || '仓库验证失败')
      }

      // 连接仓库（RepositoriesService 会检查权限和重复）
      const repository = await this.repositories.connect(userId, {
        projectId,
        provider: config.provider,
        fullName: parsed.fullName,
        cloneUrl: config.url,
        defaultBranch: config.defaultBranch || 'main',
      })

      if (!repository) {
        throw new Error('连接仓库失败，请稍后重试')
      }

      this.logger.log(`Repository connected successfully: ${repository.id}`)
      return repository
    } catch (error) {
      this.logger.error(`Failed to connect existing repository:`, {
        url: config.url,
        provider: config.provider,
        error: error instanceof Error ? error.message : '未知错误',
      })
      throw error
    }
  }

  /**
   * 创建新仓库并初始化项目（异步）
   * Requirements: 4.1, 4.2, 4.3, 4.4
   *
   * 使用完整的项目初始化 Worker，负责：
   * 1. 创建 Git 仓库
   * 2. 推送初始代码（包含 K8s overlays）
   * 3. 创建 GitOps 资源
   * 4. 更新项目状态
   *
   * 前端通过 SSE 监听整个流程的进度
   */
  private async createNewRepositoryAndConnect(
    userId: string,
    projectId: string,
    organizationId: string,
    environmentIds: string[], // 直接传递环境 ID，避免查询
    config: Extract<NonNullable<CreateProjectWithTemplateInput['repository']>, { mode: 'create' }>,
  ): Promise<{ jobId: string; repositoryName: string }> {
    this.logger.log(`Queueing project initialization: ${config.name}`)

    try {
      // 将完整的项目初始化任务加入队列
      const job = await this.projectInitQueue.add(
        'initialize-project',
        {
          projectId,
          userId,
          organizationId,
          repository: {
            provider: config.provider,
            name: config.name,
            visibility: config.visibility || 'private',
            defaultBranch: config.defaultBranch || 'main',
            accessToken: config.accessToken,
          },
          environmentIds,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      )

      this.logger.log(`Project initialization queued: ${config.name} (job: ${job.id})`)

      return {
        jobId: job.id!,
        repositoryName: config.name,
      }
    } catch (error) {
      this.logger.error(`Failed to queue repository creation:`, {
        name: config.name,
        provider: config.provider,
        error: error instanceof Error ? error.message : '未知错误',
      })
      throw error
    }
  }

  /**
   * 解析仓库 URL
   */
  private parseRepositoryUrl(
    url: string,
  ): { fullName: string; provider: 'github' | 'gitlab' } | null {
    const trimmed = url.trim().replace(/\.git$/i, '')

    // 匹配 GitHub/GitLab URL
    const match = trimmed.match(
      /(?:https?:\/\/|git@)?(github\.com|gitlab\.com)(?::|\/)([^/]+\/[^/\s]+)/i,
    )

    if (!match) return null

    const host = match[1]!.toLowerCase()
    const fullName = match[2]!.replace(/\/+$/, '')
    const provider = host.includes('github') ? ('github' as const) : ('gitlab' as const)

    return { fullName, provider }
  }

  /**
   * 获取项目的完整状态
   * Requirements: 3.1, 3.2, 5.1
   */
  @Trace('project-orchestrator.getProjectStatus')
  async getProjectStatus(userId: string, projectId: string): Promise<ProjectStatus> {
    this.logger.log(`Getting status for project ${projectId}`)

    // 获取项目基本信息
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
      .limit(1)

    if (!project) {
      throw new Error('项目不存在')
    }

    // 获取关联资源
    const environments = await this.environments.list(userId, projectId)
    const repositories = await this.repositories.list(userId, projectId)
    const gitopsResources = await this.flux.listGitOpsResources(projectId)

    // 获取部署统计
    const deployments = await this.db
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.projectId, projectId))

    const successfulDeployments = deployments.filter((d) => d.status === 'success').length
    const failedDeployments = deployments.filter((d) => d.status === 'failed').length
    const lastDeployment = deployments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0]

    // 计算健康度（简化版本，完整实现在 HealthMonitor）
    const health: ProjectHealth = {
      score: 0,
      status: 'healthy',
      factors: {
        deploymentSuccessRate:
          deployments.length > 0 ? successfulDeployments / deployments.length : 1,
        gitopsSyncStatus: 'healthy',
        podHealthStatus: 'healthy',
        lastDeploymentAge: lastDeployment
          ? Math.floor((Date.now() - lastDeployment.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      },
      issues: [],
      recommendations: [],
    }

    // 获取资源使用情况（简化版本）
    const resourceUsage = {
      pods: 0,
      cpu: '0m',
      memory: '0Mi',
    }

    return {
      project: {
        id: project.id,
        organizationId: project.organizationId,
        name: project.name,
        slug: project.slug,
        description: project.description,
        logoUrl: project.logoUrl,
        visibility: project.visibility as 'public' | 'private' | 'internal',
        status: project.status as any,
        config: project.config as any,
        initializationStatus: project.initializationStatus as any,
        templateId: project.templateId,
        templateConfig: project.templateConfig as any,
        healthScore: project.healthScore,
        healthStatus: project.healthStatus as any,
        lastHealthCheck: project.lastHealthCheck,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      environments: environments.map((env) => ({
        id: env.id,
        name: env.name,
        type: env.type as any,
        config: env.config,
      })),
      repositories: repositories.map((repo) => ({
        id: repo.id,
        provider: repo.provider as 'github' | 'gitlab',
        fullName: repo.fullName,
        cloneUrl: repo.cloneUrl,
        defaultBranch: repo.defaultBranch,
      })),
      gitopsResources: gitopsResources.map((resource) => ({
        id: resource.id,
        type: resource.type as 'kustomization' | 'helm',
        name: resource.name,
        namespace: resource.namespace,
        status: resource.status,
        errorMessage: resource.errorMessage,
      })),
      stats: {
        totalDeployments: deployments.length,
        successfulDeployments,
        failedDeployments,
        lastDeploymentAt: lastDeployment?.createdAt,
      },
      health,
      resourceUsage,
    }
  }

  /**
   * 归档项目
   * Requirements: 10.1, 10.2, 10.3
   */
  @Trace('project-orchestrator.archiveProject')
  async archiveProject(userId: string, projectId: string): Promise<void> {
    this.logger.log(`Archiving project ${projectId}`)

    // 更新项目状态
    await this.db
      .update(schema.projects)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    // 暂停所有 GitOps 资源的自动同步
    const gitopsResources = await this.flux.listGitOpsResources(projectId)
    for (const resource of gitopsResources) {
      await this.flux.updateGitOpsResource(resource.id, {
        config: {
          ...resource.config,
          autoSync: false,
        },
      })
    }

    // 记录审计日志
    await this.audit.log({
      userId,
      action: 'project.archived',
      resourceType: 'project',
      resourceId: projectId,
    })

    this.logger.log(`Project ${projectId} archived successfully`)
  }

  /**
   * 恢复项目
   * Requirements: 10.2, 10.4
   */
  @Trace('project-orchestrator.restoreProject')
  async restoreProject(userId: string, projectId: string): Promise<void> {
    this.logger.log(`Restoring project ${projectId}`)

    // 更新项目状态
    await this.db
      .update(schema.projects)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    // 重启所有 GitOps 资源的自动同步
    const gitopsResources = await this.flux.listGitOpsResources(projectId)
    for (const resource of gitopsResources) {
      await this.flux.updateGitOpsResource(resource.id, {
        config: {
          ...resource.config,
          autoSync: true,
        },
      })
    }

    // 记录审计日志
    await this.audit.log({
      userId,
      action: 'project.restored',
      resourceType: 'project',
      resourceId: projectId,
    })

    this.logger.log(`Project ${projectId} restored successfully`)
  }

  /**
   * 删除项目时处理关联的 Git 仓库
   * 返回任务 ID 列表供前端监听进度
   */
  @Trace('project-orchestrator.handleRepositoryOnDelete')
  async handleRepositoryOnDelete(
    userId: string,
    projectId: string,
    action: 'archive' | 'delete',
  ): Promise<string[]> {
    this.logger.log(`Starting repository ${action} for project ${projectId}`)

    const repositories = await this.repositories.list(userId, projectId)
    this.logger.log(`Found ${repositories.length} repositories to ${action}`)

    if (repositories.length === 0) {
      this.logger.log(`No repositories found for project ${projectId}`)
      return []
    }

    // 获取用户的 OAuth 账户 token
    // 需要分别获取每个 provider 的账户（因为 listUserAccounts 不返回 token）
    const githubAccount = await this.oauthAccounts.getAccountByProvider(userId, 'github')
    const gitlabAccount = await this.oauthAccounts.getAccountByProvider(userId, 'gitlab')

    const tokenMap = new Map<string, string>()
    if (githubAccount?.accessToken) {
      tokenMap.set('github', githubAccount.accessToken)
    }
    if (gitlabAccount?.accessToken) {
      tokenMap.set('gitlab', gitlabAccount.accessToken)
    }

    this.logger.log(`Found ${tokenMap.size} OAuth accounts with tokens for user ${userId}`)

    // 将每个仓库操作加入队列
    const jobIds: string[] = []
    const failedRepos: string[] = []

    for (const repo of repositories) {
      this.logger.log(`Processing repository: ${repo.fullName} (${repo.provider})`)

      const accessToken = tokenMap.get(repo.provider)
      if (!accessToken) {
        const providerName = repo.provider === 'github' ? 'GitHub' : 'GitLab'
        this.logger.error(
          `No access token found for ${repo.provider}, cannot ${action} ${repo.fullName}`,
        )
        failedRepos.push(repo.fullName)

        // 发送通知给用户
        try {
          await this.notifications.create({
            userId,
            type: 'system',
            title: `仓库${action === 'delete' ? '删除' : '归档'}失败`,
            message: `无法${action === 'delete' ? '删除' : '归档'}仓库 ${repo.fullName}：未找到 ${providerName} 访问令牌。请前往"设置 > 账户连接"连接您的 ${providerName} 账户。`,
            priority: 'high',
          })
        } catch (notificationError) {
          this.logger.error(`Failed to send notification:`, notificationError)
        }

        continue
      }

      const jobName = action === 'archive' ? 'archive-repository' : 'delete-repository'

      const job = await this.repositoryQueue.add(
        jobName,
        {
          provider: repo.provider,
          fullName: repo.fullName,
          accessToken,
          userId,
          repositoryId: repo.id,
          projectId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      )

      if (job.id) {
        jobIds.push(job.id)
        this.logger.log(
          `Successfully queued ${action} for repository ${repo.fullName} (job: ${job.id})`,
        )
      } else {
        this.logger.error(
          `Failed to queue ${action} for repository ${repo.fullName}: no job ID returned`,
        )
        failedRepos.push(repo.fullName)
      }
    }

    // 记录总结
    this.logger.log(
      `Repository ${action} summary: ${jobIds.length} queued, ${failedRepos.length} failed`,
    )

    if (failedRepos.length > 0) {
      this.logger.warn(`Failed repositories: ${failedRepos.join(', ')}`)
    }

    return jobIds
  }

  /**
   * 订阅相关事件
   * Requirements: 11.3, 11.4, 11.5
   *
   * 使用 Redis Pub/Sub 订阅事件，实现事件驱动架构
   */
  private subscribeToEvents(): void {
    this.logger.log('Initializing event subscriptions...')

    // 使用独立的订阅连接，避免与普通命令冲突
    // 订阅 deployment.completed 事件
    this.subscriber.subscribe('events:deployment.completed', (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to deployment.completed events:', err)
      } else {
        this.logger.log('Subscribed to deployment.completed events')
      }
    })

    // 订阅 gitops.sync.status 事件
    this.subscriber.subscribe('events:gitops.sync.status', (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to gitops.sync.status events:', err)
      } else {
        this.logger.log('Subscribed to gitops.sync.status events')
      }
    })

    // 订阅 environment.updated 事件
    this.subscriber.subscribe('events:environment.updated', (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to environment.updated events:', err)
      } else {
        this.logger.log('Subscribed to environment.updated events')
      }
    })

    // 处理接收到的消息
    this.subscriber.on('message', (channel, message) => {
      this.logger.log(`Received message on channel ${channel}`)

      try {
        const event = JSON.parse(message)

        switch (channel) {
          case 'events:deployment.completed':
            this.handleDeploymentCompleted(event as DeploymentCompletedEvent).catch((error) => {
              this.logger.error('Error handling deployment.completed event:', error)
            })
            break

          case 'events:gitops.sync.status':
            this.handleGitOpsSyncStatus(event as GitOpsSyncStatusEvent).catch((error) => {
              this.logger.error('Error handling gitops.sync.status event:', error)
            })
            break

          case 'events:environment.updated':
            this.handleEnvironmentUpdated(event as EnvironmentUpdatedEvent).catch((error) => {
              this.logger.error('Error handling environment.updated event:', error)
            })
            break

          default:
            this.logger.warn(`Unknown event channel: ${channel}`)
        }
      } catch (error) {
        this.logger.error(`Failed to parse event message from ${channel}:`, error)
      }
    })

    this.logger.log('Event subscriptions initialized successfully')
  }

  /**
   * 发布事件到事件总线
   * Requirements: 11.1, 11.2
   *
   * 发布事件到 Queue 和数据库，供其他服务订阅和处理
   */
  private async publishEvent(event: ProjectEvent): Promise<void> {
    try {
      this.logger.log(`Publishing event: ${event.type} for project ${event.projectId}`)

      // 1. 发布到事件总线（使用 Queue）
      // 使用事件类型作为 job name，这样可以被对应的 worker 处理
      await this.queue.add(event.type, event, {
        attempts: 3, // 重试 3 次
        backoff: {
          type: 'exponential',
          delay: 2000, // 初始延迟 2 秒
        },
        removeOnComplete: true, // 完成后移除
        removeOnFail: false, // 失败后保留用于调试
      })

      // 2. 记录到数据库（持久化事件历史）
      await this.db.insert(schema.projectEvents).values({
        projectId: event.projectId,
        eventType: event.type,
        eventData: event as any,
        triggeredBy: 'createdBy' in event ? event.createdBy : undefined,
      })

      this.logger.log(`Event published successfully: ${event.type}`)
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}:`, error)
      // 不抛出错误，避免影响主流程
      // 事件发布失败不应该导致业务操作失败
    }
  }

  /**
   * 处理部署完成事件
   * Requirements: 11.5
   *
   * 当部署完成时，更新项目健康度
   */
  async handleDeploymentCompleted(event: DeploymentCompletedEvent): Promise<void> {
    this.logger.log(
      `Handling deployment completed event for project ${event.projectId}, status: ${event.status}`,
    )

    try {
      // 获取项目当前健康度
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, event.projectId))
        .limit(1)

      if (!project) {
        this.logger.warn(`Project ${event.projectId} not found`)
        return
      }

      // 简化的健康度计算（完整实现在 HealthMonitor）
      // 获取最近 10 次部署
      const recentDeployments = await this.db
        .select()
        .from(schema.deployments)
        .where(eq(schema.deployments.projectId, event.projectId))
        .orderBy(schema.deployments.createdAt)
        .limit(10)

      const successCount = recentDeployments.filter((d) => d.status === 'success').length
      const totalCount = recentDeployments.length

      // 计算成功率
      const successRate = totalCount > 0 ? successCount / totalCount : 1
      const healthScore = Math.round(successRate * 100)

      // 确定健康状态
      let healthStatus: 'healthy' | 'warning' | 'critical'
      if (healthScore >= 80) {
        healthStatus = 'healthy'
      } else if (healthScore >= 50) {
        healthStatus = 'warning'
      } else {
        healthStatus = 'critical'
      }

      // 更新项目健康度
      await this.db
        .update(schema.projects)
        .set({
          healthScore,
          healthStatus,
          lastHealthCheck: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, event.projectId))

      this.logger.log(`Updated project ${event.projectId} health: ${healthScore} (${healthStatus})`)

      // 如果健康度变为 critical，发送告警
      if (healthStatus === 'critical' && project.healthStatus !== 'critical') {
        await this.notifications.create({
          userId: project.organizationId, // 发送给组织
          type: 'system',
          title: '项目健康度告警',
          message: `项目 "${project.name}" 的健康度降至 ${healthScore}，请及时处理`,
          priority: 'high',
        })

        this.logger.log(`Sent critical health alert for project ${event.projectId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to handle deployment completed event:`, error)
    }
  }

  /**
   * 处理 GitOps 同步状态事件
   * Requirements: 11.5
   *
   * 当 GitOps 资源同步状态变化时，更新项目状态
   */
  async handleGitOpsSyncStatus(event: GitOpsSyncStatusEvent): Promise<void> {
    this.logger.log(
      `Handling GitOps sync status event for project ${event.projectId}, status: ${event.status}`,
    )

    try {
      // 更新 GitOps 资源状态
      await this.db
        .update(schema.gitopsResources)
        .set({
          status: event.status,
          errorMessage: event.errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(schema.gitopsResources.id, event.resourceId))

      // 如果同步失败，发送通知
      if (event.status === 'failed') {
        const [project] = await this.db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, event.projectId))
          .limit(1)

        if (project) {
          await this.notifications.create({
            userId: project.organizationId,
            type: 'system',
            title: 'GitOps 同步失败',
            message: `项目 "${project.name}" 的 GitOps 资源同步失败: ${event.errorMessage || '未知错误'}`,
            priority: 'high',
          })

          this.logger.log(`Sent GitOps sync failure notification for project ${event.projectId}`)
        }
      }

      this.logger.log(`Updated GitOps resource ${event.resourceId} status to ${event.status}`)
    } catch (error) {
      this.logger.error(`Failed to handle GitOps sync status event:`, error)
    }
  }

  /**
   * 处理环境更新事件
   * Requirements: 11.5
   *
   * 当环境配置更新时，触发相关的重新计算
   */
  async handleEnvironmentUpdated(event: EnvironmentUpdatedEvent): Promise<void> {
    this.logger.log(
      `Handling environment updated event for project ${event.projectId}, environment ${event.environmentId}`,
    )

    try {
      // 如果更新了 GitOps 配置，可能需要重新创建 GitOps 资源
      if (event.updatedFields.includes('gitops')) {
        this.logger.log(
          `GitOps configuration updated for environment ${event.environmentId}, may need to reconcile`,
        )

        // 获取环境的 GitOps 资源
        const gitopsResources = await this.db
          .select()
          .from(schema.gitopsResources)
          .where(eq(schema.gitopsResources.environmentId, event.environmentId))

        // 触发 GitOps 资源的 reconciliation
        for (const resource of gitopsResources) {
          try {
            await this.flux.triggerReconciliation(
              resource.type === 'kustomization' ? 'Kustomization' : 'HelmRelease',
              resource.name,
              resource.namespace,
            )
            this.logger.log(`Triggered reconciliation for GitOps resource ${resource.id}`)
          } catch (error) {
            this.logger.error(
              `Failed to trigger reconciliation for resource ${resource.id}:`,
              error,
            )
          }
        }
      }

      // 如果更新了审批配置，记录审计日志
      if (event.updatedFields.includes('approvalRequired')) {
        await this.audit.log({
          userId: 'system',
          action: 'environment.approval.config.changed',
          resourceType: 'environment',
          resourceId: event.environmentId,
          metadata: {
            projectId: event.projectId,
            updatedFields: event.updatedFields,
          },
        })
      }

      this.logger.log(`Handled environment updated event for ${event.environmentId}`)
    } catch (error) {
      this.logger.error(`Failed to handle environment updated event:`, error)
    }
  }

  /**
   * 更新初始化状态
   */
  private async updateInitializationStatus(
    projectId: string,
    status: {
      step: string
      progress: number
      completedSteps: string[]
      error?: string
      jobId?: string
    },
  ): Promise<void> {
    await this.db
      .update(schema.projects)
      .set({
        initializationStatus: status as any,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
  }

  /**
   * 回滚已创建的资源
   * Requirements: 1.5, 2.5, 4.2, 4.3
   *
   * 在初始化失败时清理所有已创建的资源，确保不留下孤立资源
   * 回滚失败不会阻止错误报告，但会记录详细日志
   */
  private async rollbackResources(
    projectId: string,
    resources: InitializationResult['createdResources'],
  ): Promise<void> {
    this.logger.log(`Starting rollback for project ${projectId}`, {
      gitopsResources: resources.gitopsResources.length,
      repositories: resources.repositories.length,
      environments: resources.environments.length,
    })

    const rollbackErrors: Array<{ type: string; id: string; error: string }> = []
    let successCount = 0
    let failureCount = 0

    // 1. 删除 GitOps 资源（最先删除，避免继续同步）
    this.logger.log(`Rolling back ${resources.gitopsResources.length} GitOps resources`)
    for (const resourceId of resources.gitopsResources) {
      try {
        await this.flux.deleteGitOpsResource(resourceId)
        successCount++
        this.logger.log(`Successfully deleted GitOps resource: ${resourceId}`)
      } catch (error) {
        failureCount++
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        this.logger.error(`Failed to delete GitOps resource ${resourceId}:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        })
        rollbackErrors.push({
          type: 'gitops_resource',
          id: resourceId,
          error: errorMessage,
        })
      }
    }

    // 2. 删除仓库连接（注意：不删除远程仓库，只删除数据库记录）
    this.logger.log(`Rolling back ${resources.repositories.length} repository connections`)
    for (const repositoryId of resources.repositories) {
      try {
        await this.repositories.disconnect('system', repositoryId)
        successCount++
        this.logger.log(`Successfully disconnected repository: ${repositoryId}`)
      } catch (error) {
        failureCount++
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        this.logger.error(`Failed to disconnect repository ${repositoryId}:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        })
        rollbackErrors.push({
          type: 'repository',
          id: repositoryId,
          error: errorMessage,
        })
      }
    }

    const shouldRollbackEnvironments = resources.repositories.length > 0
    if (shouldRollbackEnvironments) {
      this.logger.log(`Rolling back ${resources.environments.length} environments`)
      for (const environmentId of resources.environments) {
        try {
          await this.environments.delete('system', environmentId)
          successCount++
          this.logger.log(`Successfully deleted environment: ${environmentId}`)
        } catch (error) {
          failureCount++
          const errorMessage = error instanceof Error ? error.message : '未知错误'
          this.logger.error(`Failed to delete environment ${environmentId}:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          })
          rollbackErrors.push({
            type: 'environment',
            id: environmentId,
            error: errorMessage,
          })
        }
      }
    } else {
      this.logger.log('Skipping environment rollback because no repository was created')
    }

    // 记录回滚结果摘要
    const totalResources =
      resources.gitopsResources.length +
      resources.repositories.length +
      resources.environments.length

    if (rollbackErrors.length === 0) {
      this.logger.log(
        `Rollback completed successfully for project ${projectId}: ${successCount}/${totalResources} resources cleaned up`,
      )
    } else {
      this.logger.warn(
        `Rollback completed with errors for project ${projectId}: ${successCount}/${totalResources} resources cleaned up, ${failureCount} failed`,
        {
          errors: rollbackErrors,
        },
      )

      // 记录审计日志，便于后续手动清理
      try {
        await this.audit.log({
          userId: 'system',
          action: 'project.rollback.partial_failure',
          resourceType: 'project',
          resourceId: projectId,
          metadata: {
            successCount,
            failureCount,
            totalResources,
            errors: rollbackErrors,
          },
        })
      } catch (auditError) {
        this.logger.error(`Failed to log rollback audit:`, auditError)
      }
    }
  }
}
