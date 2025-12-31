/**
 * Git 同步服务
 *
 * 负责协调平台与 Git 平台的同步操作
 * Requirements: 4.2, 4.8, 7.2
 *
 * ✅ 架构清理：直接使用 Core 层服务
 * - FluxCliService: Flux CLI 操作
 * - K8sClientService: K8s 资源操作
 * - EventEmitter2: 事件发射（不使用自定义包装器）
 */

import { FluxCliService } from '@juanie/core/flux'
import { K8sClientService } from '@juanie/core/k8s'
import { GitConnectionsService, GitSyncLogsService } from '@juanie/service-foundation'
import type { ProjectRole } from '@juanie/types'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import { PinoLogger } from 'nestjs-pino'
import { ProjectsService } from '../../projects/core/projects.service'

/**
 * Git 同步任务数据
 */
export interface GitSyncMemberJob {
  projectId: string
  userId: string
  role: ProjectRole
}

export interface GitSyncRemoveMemberJob {
  projectId: string
  userId: string
}

export interface GitSyncBatchJob {
  projectId: string
}

/**
 * Git 同步服务
 *
 * 使用队列异步处理同步任务，避免阻塞用户操作
 * ✅ 直接使用 Core 层服务，不再包装
 */
@Injectable()
export class GitSyncService {
  constructor(
    @InjectQueue('git-sync') private readonly queue: Queue,
    private readonly projects: ProjectsService,
    private readonly gitConnections: GitConnectionsService,
    private readonly gitSyncLogs: GitSyncLogsService,
    private readonly fluxCli: FluxCliService, // ✅ 直接注入 Core 层服务
    private readonly k8sClient: K8sClientService, // ✅ 直接注入 Core 层服务
    private readonly eventEmitter: EventEmitter2, // ✅ 直接使用 EventEmitter2
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitSyncService.name)
  }

  /**
   * 同步项目成员权限到 Git 平台
   * Requirements: 4.2, 4.3, 4.4
   *
   * 使用队列异步处理，避免阻塞用户操作
   *
   * @param projectId - 项目 ID
   * @param userId - 用户 ID
   * @param role - 项目角色
   */
  async syncProjectMember(projectId: string, userId: string, role: ProjectRole): Promise<void> {
    this.logger.info(`Queueing member sync: project=${projectId}, user=${userId}, role=${role}`)

    // ✅ 使用 ProjectsService 检查项目
    const project = await this.projects.findById(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // ✅ 使用 GitConnectionsService 检查 Git 认证
    const projectAuth = await this.gitConnections.getProjectAuth(projectId)
    if (!projectAuth) {
      this.logger.warn(`Project ${projectId} has no Git authentication configured, skipping sync`)
      return
    }

    // ✅ 使用 GitConnectionsService 获取 provider
    const connection = await this.gitConnections.getConnectionById(projectAuth.oauthAccountId!)
    if (!connection) {
      throw new Error(`Git connection ${projectAuth.oauthAccountId} not found`)
    }
    const provider = connection.provider as 'github' | 'gitlab'

    // ✅ 使用 GitSyncLogsService 创建日志 (使用正确的枚举值)
    const syncLog = await this.gitSyncLogs.create({
      projectId,
      syncType: 'member', // ✅ 匹配 schema 枚举
      action: 'sync',
      status: 'pending',
      gitProvider: provider,
      gitResourceId: projectId,
      gitResourceType: 'member',
      metadata: {
        userId,
        systemRole: role,
        attemptCount: 0,
      },
    })

    if (!syncLog) {
      throw new Error('Failed to create sync log')
    }

    // 添加到队列
    await this.queue.add(
      'sync-member',
      {
        projectId,
        userId,
        role,
        syncLogId: syncLog.id,
      } as GitSyncMemberJob & { syncLogId: string },
      {
        jobId: `sync-member-${projectId}-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.info(`Member sync queued: ${syncLog.id}`)
  }

  /**
   * 移除成员的 Git 权限
   * Requirements: 4.8
   *
   * @param projectId - 项目 ID
   * @param userId - 用户 ID
   */
  async removeMemberAccess(projectId: string, userId: string): Promise<void> {
    this.logger.info(`Queueing member removal: project=${projectId}, user=${userId}`)

    // ✅ 使用 ProjectsService 检查项目
    const project = await this.projects.findById(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // ✅ 使用 GitConnectionsService 检查 Git 认证
    const projectAuth = await this.gitConnections.getProjectAuth(projectId)
    if (!projectAuth) {
      this.logger.warn(
        `Project ${projectId} has no Git authentication configured, skipping removal`,
      )
      return
    }

    // ✅ 使用 GitConnectionsService 获取 provider
    const connection = await this.gitConnections.getConnectionById(projectAuth.oauthAccountId!)
    if (!connection) {
      throw new Error(`Git connection ${projectAuth.oauthAccountId} not found`)
    }
    const provider = connection.provider as 'github' | 'gitlab'

    // ✅ 使用 GitSyncLogsService 创建日志 (使用正确的枚举值)
    const syncLog = await this.gitSyncLogs.create({
      projectId,
      syncType: 'member', // ✅ 匹配 schema 枚举
      action: 'remove',
      status: 'pending',
      gitProvider: provider,
      gitResourceId: projectId,
      gitResourceType: 'member',
      metadata: {
        userId,
        action: 'delete',
        attemptCount: 0,
      },
    })

    if (!syncLog) {
      throw new Error('Failed to create sync log')
    }

    // 添加到队列
    await this.queue.add(
      'remove-member',
      {
        projectId,
        userId,
        syncLogId: syncLog.id,
      } as GitSyncRemoveMemberJob & { syncLogId: string },
      {
        jobId: `remove-member-${projectId}-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.info(`Member removal queued: ${syncLog.id}`)
  }

  /**
   * 批量同步项目（用于迁移现有项目）
   * Requirements: 7.2, 7.3
   *
   * @param projectId - 项目 ID
   */
  async batchSyncProject(projectId: string): Promise<void> {
    this.logger.info(`Queueing batch sync for project: ${projectId}`)

    // ✅ 使用 ProjectsService 检查项目
    const project = await this.projects.findById(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // ✅ 使用 GitConnectionsService 检查 Git 认证
    const projectAuth = await this.gitConnections.getProjectAuth(projectId)
    if (!projectAuth) {
      throw new Error(`Project ${projectId} has no Git authentication configured`)
    }

    // ✅ 使用 GitConnectionsService 获取 provider
    const connection = await this.gitConnections.getConnectionById(projectAuth.oauthAccountId!)
    if (!connection) {
      throw new Error(`Git connection ${projectAuth.oauthAccountId} not found`)
    }
    const provider = connection.provider as 'github' | 'gitlab'

    // ✅ 使用 GitSyncLogsService 创建日志 (使用正确的枚举值)
    const syncLog = await this.gitSyncLogs.create({
      projectId,
      syncType: 'project', // ✅ 匹配 schema 枚举
      action: 'sync',
      status: 'pending',
      gitProvider: provider,
      gitResourceId: projectId,
      gitResourceType: 'repository',
      metadata: {
        action: 'batch-sync',
        attemptCount: 0,
      },
    })

    if (!syncLog) {
      throw new Error('Failed to create sync log')
    }

    // 添加到队列
    await this.queue.add(
      'batch-sync',
      {
        projectId,
        syncLogId: syncLog.id,
      } as GitSyncBatchJob & { syncLogId: string },
      {
        jobId: `batch-sync-${projectId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.info(`Batch sync queued: ${syncLog.id}`)
  }

  /**
   * 获取同步日志
   *
   * @param projectId - 项目 ID
   * @param limit - 返回数量限制
   */
  async getSyncLogs(projectId: string, limit = 50) {
    // ✅ 使用 GitSyncLogsService
    return this.gitSyncLogs.findByProject(projectId, limit)
  }

  /**
   * 获取失败的同步任务
   *
   * @param projectId - 项目 ID（可选）
   */
  async getFailedSyncs(projectId?: string) {
    // ✅ 使用 GitSyncLogsService
    if (projectId) {
      return this.gitSyncLogs.findFailedLogs(projectId, 100)
    }

    // 如果没有 projectId，返回空数组（避免跨项目查询）
    return []
  }

  /**
   * 重试失败的同步任务
   *
   * @param syncLogId - 同步日志 ID
   */
  async retrySyncTask(syncLogId: string): Promise<void> {
    this.logger.info(`Retrying sync task: ${syncLogId}`)

    // ✅ 使用 GitSyncLogsService 获取日志
    const syncLog = await this.gitSyncLogs.findById(syncLogId)
    if (!syncLog) {
      throw new Error(`Sync log ${syncLogId} not found`)
    }

    if (syncLog.status !== 'failed') {
      throw new Error(`Sync log ${syncLogId} is not in failed state`)
    }

    // ✅ 使用 GitSyncLogsService 更新状态
    await this.gitSyncLogs.updateStatus(syncLogId, {
      status: 'pending',
      error: undefined,
    })

    // 根据同步类型重新添加到队列
    const metadata = syncLog.metadata as any
    if (syncLog.syncType === 'member') {
      if (metadata?.action === 'delete') {
        await this.queue.add(
          'remove-member',
          {
            projectId: syncLog.projectId!,
            userId: metadata.userId,
            syncLogId: syncLog.id,
          },
          {
            jobId: `retry-remove-member-${syncLog.projectId}-${metadata.userId}-${Date.now()}`,
          },
        )
      } else {
        // 添加或更新成员
        const role = metadata?.systemRole || 'developer'
        await this.queue.add(
          'sync-member',
          {
            projectId: syncLog.projectId!,
            userId: metadata.userId,
            role,
            syncLogId: syncLog.id,
          },
          {
            jobId: `retry-sync-member-${syncLog.projectId}-${metadata.userId}-${Date.now()}`,
          },
        )
      }
    } else if (syncLog.syncType === 'project') {
      await this.queue.add(
        'batch-sync',
        {
          projectId: syncLog.projectId!,
          syncLogId: syncLog.id,
        },
        {
          jobId: `retry-batch-sync-${syncLog.projectId}-${Date.now()}`,
        },
      )
    }

    this.logger.info(`Sync task retried: ${syncLogId}`)
  }

  /**
   * ✅ 同步 Git 仓库到 Flux
   * 直接使用 Core 层的 FluxCliService 创建 GitRepository 和 Kustomization
   *
   * Requirements: 4.1, 8.1
   *
   * @param options - 同步选项
   */
  async syncRepositoryToFlux(options: {
    projectId: string
    repoUrl: string
    branch: string
    namespace: string
    path?: string
    interval?: string
    secretRef?: string
  }): Promise<void> {
    const {
      projectId,
      repoUrl,
      branch,
      namespace,
      path = './k8s',
      interval = '1m',
      secretRef,
    } = options

    this.logger.info({ projectId, namespace }, 'Syncing Git repository to Flux')

    try {
      // ✅ 步骤 1: 使用 FluxCliService 创建 GitRepository
      // 不需要包装，直接调用 Core 层方法
      const gitRepoName = `project-${projectId}`

      // 构建 GitRepository 创建参数
      const gitRepoOptions: any = {
        name: gitRepoName,
        namespace,
        url: repoUrl,
        branch,
        interval,
      }

      // 如果提供了 secretRef，添加到选项中
      if (secretRef) {
        gitRepoOptions.secretRef = secretRef
      }

      // Create GitRepository using K8sClientService
      await this.createGitRepositoryResource(gitRepoOptions)

      // ✅ 步骤 2: 创建 Kustomization
      await this.createKustomizationResource({
        name: gitRepoName,
        namespace,
        sourceRef: {
          kind: 'GitRepository',
          name: gitRepoName,
        },
        path,
        interval,
        prune: true,
      })

      // ✅ 步骤 3: 触发立即 reconcile
      await this.fluxCli.reconcile('gitrepository', gitRepoName, namespace)
      await this.fluxCli.reconcile('kustomization', gitRepoName, namespace)

      // ✅ 步骤 4: 检查资源状态
      interface GitRepositoryStatus {
        status?: {
          conditions?: Array<{ type: string; status: string; reason?: string }>
        }
      }

      const gitRepo = (await this.k8sClient.getNamespacedCustomObject({
        group: 'source.toolkit.fluxcd.io',
        version: 'v1',
        namespace,
        plural: 'gitrepositories',
        name: gitRepoName,
      })) as GitRepositoryStatus

      // ✅ 直接使用 EventEmitter2 发射事件
      this.eventEmitter.emit('git-sync.repository.synced', {
        projectId,
        repoUrl,
        branch,
        namespace,
        status: gitRepo.status,
        timestamp: new Date(),
      })

      this.logger.info({ projectId, namespace }, 'Git repository synced to Flux successfully')
    } catch (error: any) {
      // ✅ 直接发射失败事件
      this.eventEmitter.emit('git-sync.repository.failed', {
        projectId,
        error: error.message,
        timestamp: new Date(),
      })

      this.logger.error({ projectId, error }, 'Failed to sync Git repository to Flux')
      throw error
    }
  }

  /**
   * ✅ 创建 GitRepository Custom Resource
   * 直接使用 K8sClientService，不包装
   *
   * @private
   */
  private async createGitRepositoryResource(options: {
    name: string
    namespace: string
    url: string
    branch: string
    interval: string
    secretRef?: string
  }): Promise<void> {
    const gitRepository = {
      apiVersion: 'source.toolkit.fluxcd.io/v1',
      kind: 'GitRepository',
      metadata: {
        name: options.name,
        namespace: options.namespace,
      },
      spec: {
        url: options.url,
        ref: {
          branch: options.branch,
        },
        interval: options.interval,
        ...(options.secretRef && {
          secretRef: {
            name: options.secretRef,
          },
        }),
      },
    }

    // ✅ 直接使用 K8sClientService 创建资源
    const customApi = this.k8sClient.getCustomObjectsApi()
    await customApi.createNamespacedCustomObject({
      group: 'source.toolkit.fluxcd.io',
      version: 'v1',
      namespace: options.namespace,
      plural: 'gitrepositories',
      body: gitRepository,
    })

    this.logger.debug({ name: options.name, namespace: options.namespace }, 'GitRepository created')
  }

  /**
   * ✅ 创建 Kustomization Custom Resource
   * 直接使用 K8sClientService，不包装
   *
   * @private
   */
  private async createKustomizationResource(options: {
    name: string
    namespace: string
    sourceRef: { kind: string; name: string }
    path: string
    interval: string
    prune: boolean
  }): Promise<void> {
    const kustomization = {
      apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
      kind: 'Kustomization',
      metadata: {
        name: options.name,
        namespace: options.namespace,
      },
      spec: {
        sourceRef: options.sourceRef,
        path: options.path,
        interval: options.interval,
        prune: options.prune,
      },
    }

    // ✅ 直接使用 K8sClientService 创建资源
    const customApi = this.k8sClient.getCustomObjectsApi()
    await customApi.createNamespacedCustomObject({
      group: 'kustomize.toolkit.fluxcd.io',
      version: 'v1',
      namespace: options.namespace,
      plural: 'kustomizations',
      body: kustomization,
    })

    this.logger.debug({ name: options.name, namespace: options.namespace }, 'Kustomization created')
  }

  /**
   * ✅ 手动触发项目部署
   * 强制 Flux 立即同步指定环境的 Kustomization
   *
   * Requirements: 4.1
   *
   * @param projectId - 项目 ID
   * @param environment - 环境名称
   */
  async triggerDeployment(projectId: string, environment: string): Promise<void> {
    const namespace = `project-${projectId}-${environment}`
    const kustomizationName = `${projectId}-${environment}`

    this.logger.info(`Triggering deployment for project ${projectId} ${environment}`)

    try {
      // ✅ 直接使用 FluxCliService 触发 reconcile
      await this.fluxCli.reconcile('kustomization', kustomizationName, namespace)

      // ✅ 直接发射事件
      this.eventEmitter.emit('deployment.triggered', {
        projectId,
        environment,
        namespace,
        timestamp: new Date(),
      })

      this.logger.info(`✅ Deployment triggered for ${projectId} ${environment}`)
    } catch (error: any) {
      this.eventEmitter.emit('deployment.trigger.failed', {
        projectId,
        environment,
        error: error.message,
        timestamp: new Date(),
      })

      throw error
    }
  }

  /**
   * ✅ 删除 Flux 资源
   * 直接使用 K8sClientService 删除 GitRepository 和 Kustomization
   *
   * Requirements: 4.1
   *
   * @param projectId - 项目 ID
   * @param namespace - 命名空间
   */
  async deleteFluxResources(projectId: string, namespace: string): Promise<void> {
    const resourceName = `project-${projectId}`

    this.logger.info({ projectId, namespace }, 'Deleting Flux resources')

    try {
      const customApi = this.k8sClient.getCustomObjectsApi()

      // ✅ 删除 Kustomization
      try {
        await customApi.deleteNamespacedCustomObject({
          group: 'kustomize.toolkit.fluxcd.io',
          version: 'v1',
          namespace,
          plural: 'kustomizations',
          name: resourceName,
        })
        this.logger.debug({ name: resourceName, namespace }, 'Kustomization deleted')
      } catch (error: any) {
        if (error.statusCode !== 404) {
          throw error
        }
        this.logger.debug({ name: resourceName }, 'Kustomization not found, skipping')
      }

      // ✅ 删除 GitRepository
      try {
        await customApi.deleteNamespacedCustomObject({
          group: 'source.toolkit.fluxcd.io',
          version: 'v1',
          namespace,
          plural: 'gitrepositories',
          name: resourceName,
        })
        this.logger.debug({ name: resourceName, namespace }, 'GitRepository deleted')
      } catch (error: any) {
        if (error.statusCode !== 404) {
          throw error
        }
        this.logger.debug({ name: resourceName }, 'GitRepository not found, skipping')
      }

      // ✅ 直接发射事件
      this.eventEmitter.emit('git-sync.resources.deleted', {
        projectId,
        namespace,
        timestamp: new Date(),
      })

      this.logger.info({ projectId, namespace }, 'Flux resources deleted successfully')
    } catch (error: any) {
      this.eventEmitter.emit('git-sync.resources.delete.failed', {
        projectId,
        namespace,
        error: error.message,
        timestamp: new Date(),
      })

      this.logger.error({ projectId, namespace, error }, 'Failed to delete Flux resources')
      throw error
    }
  }
}
