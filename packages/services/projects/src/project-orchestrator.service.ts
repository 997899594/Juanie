import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DEPLOYMENT_QUEUE } from '@juanie/core-queue'
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
    @Inject(REDIS) private redis: Redis,
    private environments: EnvironmentsService,
    private repositories: RepositoriesService,
    private flux: FluxService,
    private templates: TemplateManager,
    private audit: AuditLogsService,
    private notifications: NotificationsService,
    private oauthAccounts: OAuthAccountsService,
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
  ): Promise<typeof schema.projects.$inferSelect> {
    this.logger.log(`Creating and initializing project: ${data.name}`)

    // 创建 Project 记录（status: initializing）
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
      throw new Error('创建项目失败')
    }

    try {
      // 发布 project.created 事件
      await this.publishEvent({
        type: 'project.created',
        projectId: project.id,
        organizationId: project.organizationId,
        templateId: data.templateId,
        createdBy: userId,
        timestamp: new Date(),
      })

      // 记录审计日志
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

      // 如果提供了模板，开始初始化流程
      if (data.templateId) {
        // 异步执行初始化流程，不阻塞响应
        this.initializeFromTemplate(userId, project.id, data.templateId, {
          repository: data.repository,
          templateConfig: data.templateConfig,
        }).catch((error) => {
          this.logger.error(`Failed to initialize project ${project.id}:`, error)
        })
      } else {
        // 没有模板，直接标记为 active
        await this.db
          .update(schema.projects)
          .set({
            status: 'active',
            initializationStatus: {
              step: 'completed',
              progress: 100,
              completedSteps: ['create_project'],
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, project.id))
      }

      return project
    } catch (error) {
      // 如果初始化失败，回滚项目
      await this.rollbackProject(project.id, error as Error)
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

      // 2. 创建环境（development, staging, production）
      this.logger.log(`Creating environments for project ${projectId}`)
      const environmentTypes: Array<'development' | 'staging' | 'production'> = [
        'development',
        'staging',
        'production',
      ]

      for (const envType of environmentTypes) {
        const envTemplate = template.defaultConfig.environments.find((e) => e.type === envType)
        if (!envTemplate) {
          this.logger.warn(`No template found for environment type: ${envType}`)
          continue
        }

        const environment = await this.environments.create(userId, {
          projectId,
          name: envTemplate.name,
          type: envType,
          config: {
            approvalRequired: envType === 'production',
            minApprovals: envType === 'production' ? 1 : 0,
          },
        })

        if (environment) {
          createdResources.environments.push(environment.id)
          this.logger.log(`Created environment: ${environment.name} (${environment.id})`)
        }
      }

      await this.updateInitializationStatus(projectId, {
        step: 'create_environments',
        progress: 40,
        completedSteps: ['create_project', 'load_template'],
      })

      // 3. 处理 Git 仓库
      if (config.repository) {
        this.logger.log(`Processing repository for project ${projectId}`)

        // 处理 OAuth 令牌
        const repositoryConfig = await this.resolveAccessToken(userId, config.repository)

        const repository = await this.handleRepository(userId, projectId, repositoryConfig)
        createdResources.repositories.push(repository.id)

        await this.updateInitializationStatus(projectId, {
          step: 'setup_repository',
          progress: 60,
          completedSteps: ['create_project', 'load_template', 'create_environments'],
        })

        // 4. 生成 K8s 配置文件并提交到 Git
        this.logger.log(`Generating K8s configurations for project ${projectId}`)
        await this.generateAndCommitK8sConfigs(
          userId,
          projectId,
          repository.id,
          template,
          config.templateConfig,
        )

        await this.updateInitializationStatus(projectId, {
          step: 'generate_k8s_configs',
          progress: 80,
          completedSteps: [
            'create_project',
            'load_template',
            'create_environments',
            'setup_repository',
          ],
        })

        // 5. 创建 GitOps 资源
        this.logger.log(`Creating GitOps resources for project ${projectId}`)
        const environments = await this.environments.list(userId, projectId)

        for (const environment of environments) {
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
        }
      }

      // 6. 更新项目状态为 active
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
              'generate_k8s_configs',
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
      }
    } catch (error) {
      this.logger.error(`Failed to initialize project ${projectId}:`, error)

      // 回滚已创建的资源
      await this.rollbackResources(projectId, createdResources)

      // 更新项目状态为 failed
      await this.db
        .update(schema.projects)
        .set({
          status: 'failed',
          initializationStatus: {
            step: 'failed',
            progress: 0,
            error: error instanceof Error ? error.message : '未知错误',
            completedSteps: [],
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      // 发送失败通知
      await this.notifications.create({
        userId,
        type: 'system',
        title: '项目初始化失败',
        message: `项目 "${projectId}" 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`,
        priority: 'high',
      })

      return {
        success: false,
        projectId,
        createdResources,
        errors: [error instanceof Error ? error.message : '未知错误'],
      }
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
    // 如果不是使用 OAuth 令牌，直接返回
    if (repositoryConfig.accessToken !== '__USE_OAUTH__') {
      return repositoryConfig
    }

    this.logger.log(
      `Resolving OAuth token for user ${userId}, provider: ${repositoryConfig.provider}`,
    )

    // 从数据库获取 OAuth 账户
    const oauthAccount = await this.oauthAccounts.getAccountByProvider(
      userId,
      repositoryConfig.provider,
    )

    if (!oauthAccount || !oauthAccount.accessToken) {
      throw new Error(
        `未找到 ${repositoryConfig.provider === 'github' ? 'GitHub' : 'GitLab'} OAuth 账户连接，请先连接账户或手动输入访问令牌`,
      )
    }

    this.logger.log(`Successfully resolved OAuth token for ${repositoryConfig.provider}`)

    // 返回包含实际令牌的配置
    return {
      ...repositoryConfig,
      accessToken: oauthAccount.accessToken,
    }
  }

  /**
   * 处理 Git 仓库（关联现有或创建新仓库）
   * Requirements: 1.2
   */
  private async handleRepository(
    userId: string,
    projectId: string,
    repositoryConfig: NonNullable<CreateProjectWithTemplateInput['repository']>,
  ): Promise<typeof schema.repositories.$inferSelect> {
    if (repositoryConfig.mode === 'existing') {
      // 关联现有仓库
      this.logger.log(`Connecting existing repository: ${repositoryConfig.url}`)

      // 从 URL 提取 fullName (e.g., "owner/repo")
      const urlParts = repositoryConfig.url.split('/')
      const owner = urlParts[urlParts.length - 2] || ''
      const repo = (urlParts[urlParts.length - 1] || '').replace('.git', '')
      const fullName = `${owner}/${repo}`

      const repository = await this.repositories.connect(userId, {
        projectId,
        provider: repositoryConfig.provider,
        fullName,
        cloneUrl: repositoryConfig.url,
        defaultBranch: repositoryConfig.defaultBranch || 'main',
      })

      if (!repository) {
        throw new Error('连接仓库失败')
      }

      return repository
    } else {
      // 创建新仓库
      this.logger.log(`Creating new repository: ${repositoryConfig.name}`)

      // TODO: 实现创建新仓库的逻辑
      // 这需要调用 GitHub/GitLab API
      throw new Error('创建新仓库功能尚未实现')
    }
  }

  /**
   * 生成 K8s 配置文件并提交到 Git
   * Requirements: 1.2, 1.3
   */
  private async generateAndCommitK8sConfigs(
    _userId: string,
    projectId: string,
    _repositoryId: string,
    _template: any,
    _templateConfig?: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Generating K8s configs for project ${projectId}`)

    // TODO: 实现完整的 K8s 配置生成和提交逻辑
    // 这需要：
    // 1. 获取环境列表
    // 2. 为每个环境渲染模板
    // 3. 使用 GitOpsService 提交文件到 Git 仓库

    this.logger.log(`K8s configs generation placeholder for project ${projectId}`)
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
   * 回滚项目
   * Requirements: 1.5
   */
  private async rollbackProject(projectId: string, error: Error): Promise<void> {
    this.logger.error(`Rolling back project ${projectId}:`, error)

    try {
      // 软删除项目
      await this.db
        .update(schema.projects)
        .set({
          status: 'failed',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      this.logger.log(`Project ${projectId} rolled back`)
    } catch (rollbackError) {
      this.logger.error(`Failed to rollback project ${projectId}:`, rollbackError)
    }
  }

  /**
   * 回滚已创建的资源
   * Requirements: 1.5
   */
  private async rollbackResources(
    projectId: string,
    resources: InitializationResult['createdResources'],
  ): Promise<void> {
    this.logger.log(`Rolling back resources for project ${projectId}`)

    // 删除 GitOps 资源
    for (const resourceId of resources.gitopsResources) {
      try {
        await this.flux.deleteGitOpsResource(resourceId)
      } catch (error) {
        this.logger.error(`Failed to delete GitOps resource ${resourceId}:`, error)
      }
    }

    // 删除仓库连接
    for (const repositoryId of resources.repositories) {
      try {
        await this.repositories.disconnect('system', repositoryId)
      } catch (error) {
        this.logger.error(`Failed to disconnect repository ${repositoryId}:`, error)
      }
    }

    // 删除环境
    for (const environmentId of resources.environments) {
      try {
        await this.environments.delete('system', environmentId)
      } catch (error) {
        this.logger.error(`Failed to delete environment ${environmentId}:`, error)
      }
    }

    this.logger.log(`Resources rolled back for project ${projectId}`)
  }
}
