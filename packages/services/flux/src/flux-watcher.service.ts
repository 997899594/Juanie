import * as schema from '@juanie/core-database/schemas'
import { DEPLOYMENT_QUEUE } from '@juanie/core-queue'
import { DATABASE } from '@juanie/core-tokens'
import type { GitOpsSyncStatusEvent } from '@juanie/core-types'
import { K3sService } from '@juanie/service-k3s'
import * as k8s from '@kubernetes/client-node'
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Queue } from 'bullmq'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { FluxMetricsService } from './flux-metrics.service'

interface FluxResourceEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED'
  kind: string
  name: string
  namespace: string
  status?: any
  metadata?: any
}

@Injectable()
export class FluxWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FluxWatcherService.name)
  private watchers: Map<string, k8s.Watch> = new Map()
  private kc: k8s.KubeConfig
  private isWatching = false

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(DEPLOYMENT_QUEUE) private queue: Queue,
    private config: ConfigService,
    private k3s: K3sService,
    private metrics: FluxMetricsService,
  ) {
    this.kc = new k8s.KubeConfig()
  }

  async onModuleInit() {
    // 检查是否启用 Flux Watcher
    const enableFluxWatcher = this.config.get<string>('ENABLE_FLUX_WATCHER') !== 'false'

    if (!enableFluxWatcher) {
      this.logger.log('ℹ️  Flux Watcher 已禁用（ENABLE_FLUX_WATCHER=false）')
      return
    }

    // 初始化 kubeconfig
    try {
      const kubeconfigPath =
        this.config.get<string>('KUBECONFIG_PATH') || this.config.get<string>('K3S_KUBECONFIG_PATH')

      if (kubeconfigPath) {
        let path = kubeconfigPath
        if (path.startsWith('~')) {
          const homeDir = process.env.HOME || process.env.USERPROFILE
          path = path.replace('~', homeDir || '')
        }
        this.kc.loadFromFile(path)
      } else {
        this.kc.loadFromDefault()
      }

      // 在开发环境中禁用 TLS 验证
      const isDevelopment = this.config.get<string>('NODE_ENV') !== 'production'
      if (isDevelopment) {
        // 禁用 TLS 证书验证（仅开发环境）
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        this.logger.log('ℹ️  开发环境：已禁用 TLS 证书验证')
      }

      // 启动监听
      await this.startWatching()
    } catch (error: any) {
      // 静默失败，不影响应用启动
      this.logger.log('ℹ️  Flux Watcher 未启动（Kubernetes 集群不可用）')
    }
  }

  async onModuleDestroy() {
    await this.stopWatching()
  }

  /**
   * 启动监听所有 Flux 资源
   */
  async startWatching() {
    if (!this.k3s.isK3sConnected()) {
      this.logger.log('ℹ️  K3s 未连接，跳过 Flux 监听')
      return
    }

    if (this.isWatching) {
      this.logger.log('ℹ️  Flux Watcher 已在运行')
      return
    }

    try {
      // 监听 GitRepository 资源
      await this.watchResource('source.toolkit.fluxcd.io', 'v1', 'gitrepositories')

      // 监听 Kustomization 资源
      await this.watchResource('kustomize.toolkit.fluxcd.io', 'v1', 'kustomizations')

      // 监听 HelmRelease 资源
      await this.watchResource('helm.toolkit.fluxcd.io', 'v2', 'helmreleases')

      this.isWatching = true
      this.logger.log('✅ Flux Watcher 启动成功')
    } catch (error: any) {
      // 静默失败
      this.logger.log('ℹ️  Flux Watcher 启动失败（Flux 可能未安装）')
    }
  }

  /**
   * 停止所有监听
   */
  async stopWatching() {
    for (const [key, _watch] of this.watchers.entries()) {
      try {
        // Note: k8s.Watch doesn't have abort() method, we just clear the map
        console.log(`✅ 停止监听: ${key}`)
      } catch (error: any) {
        console.warn(`⚠️  停止监听失败 ${key}:`, error.message)
      }
    }

    this.watchers.clear()
    this.isWatching = false
  }

  /**
   * 监听特定类型的 Flux 资源
   */
  private async watchResource(group: string, version: string, plural: string) {
    const watch = new k8s.Watch(this.kc)
    const path = `/apis/${group}/${version}/${plural}`
    const key = `${group}/${version}/${plural}`

    try {
      await watch.watch(
        path,
        {},
        // 事件回调
        (type, apiObj, watchObj) => {
          this.handleResourceEvent(type, apiObj, watchObj).catch((error) => {
            this.logger.error(`处理 ${plural} 事件失败:`, error)
          })
        },
        // 错误回调
        (err) => {
          if (err) {
            // 如果是 Not Found 错误，说明 Flux CRD 未安装，静默跳过
            if (err.message?.includes('Not Found')) {
              return
            }

            // 其他错误也静默处理，避免日志刷屏
            this.logger.debug(`监听 ${plural} 出错: ${err.message}`)
          }

          // 不自动重连，避免在没有 Flux 的环境中持续报错
        },
      )

      this.watchers.set(key, watch)
      this.logger.log(`✅ 开始监听: ${key}`)
    } catch (error: any) {
      // 静默失败，不抛出错误
      this.logger.debug(`监听 ${plural} 失败: ${error.message}`)
    }
  }

  /**
   * 处理资源事件
   */
  private async handleResourceEvent(type: string, resource: any, _watchObj: any) {
    if (!resource || !resource.metadata) {
      return
    }

    const event: FluxResourceEvent = {
      type: type as any,
      kind: resource.kind,
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      status: resource.status,
      metadata: resource.metadata,
    }

    console.log(`📡 Flux 事件: ${event.type} ${event.kind}/${event.name} (${event.namespace})`)

    try {
      // 根据资源类型处理
      if (event.kind === 'GitRepository') {
        await this.handleGitRepositoryEvent(event)
      } else if (event.kind === 'Kustomization') {
        await this.handleKustomizationEvent(event)
      } else if (event.kind === 'HelmRelease') {
        await this.handleHelmReleaseEvent(event)
      }
    } catch (error: any) {
      console.error(`处理 ${event.kind} 事件失败:`, error.message)
    }
  }

  /**
   * 处理 GitRepository 事件
   */
  private async handleGitRepositoryEvent(event: FluxResourceEvent) {
    // 查找对应的 repository 记录
    // Note: 这里需要更复杂的查询逻辑来匹配 JSONB 字段
    // 暂时获取所有 repositories 并在内存中过滤
    const repos = await this.db.query.repositories.findMany()

    const repo = repos.find((r) => {
      const config = r.gitopsConfig as any
      return config?.fluxResourceName === event.name
    })

    if (!repo) {
      return
    }

    // 提取状态信息
    const status = event.status
    const conditions = status?.conditions || []
    const readyCondition = conditions.find((c: any) => c.type === 'Ready')

    let fluxSyncStatus = 'unknown'
    let errorMessage = null

    if (readyCondition) {
      if (readyCondition.status === 'True') {
        fluxSyncStatus = 'ready'
        // Record successful sync
        this.metrics.recordGitRepositorySync(event.name, event.namespace, 'success', 0)
      } else if (readyCondition.reason === 'Progressing') {
        fluxSyncStatus = 'reconciling'
      } else {
        fluxSyncStatus = 'failed'
        errorMessage = readyCondition.message
        // Record failed sync
        this.metrics.recordGitRepositorySync(event.name, event.namespace, 'failed', 0)
      }
    }

    // 更新数据库
    await this.db
      .update(schema.repositories)
      .set({
        fluxSyncStatus,
        fluxLastSyncCommit: status?.artifact?.revision,
        fluxLastSyncTime: status?.artifact?.lastUpdateTime
          ? new Date(status.artifact.lastUpdateTime)
          : null,
        fluxErrorMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.repositories.id, repo.id))

    console.log(`✅ 更新 GitRepository 状态: ${repo.fullName} -> ${fluxSyncStatus}`)
  }

  /**
   * 处理 Kustomization 事件
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2
   */
  private async handleKustomizationEvent(event: FluxResourceEvent) {
    // 查找对应的 gitops_resources 记录
    const resource = await this.db.query.gitopsResources.findFirst({
      where: and(
        eq(schema.gitopsResources.name, event.name),
        eq(schema.gitopsResources.namespace, event.namespace),
        eq(schema.gitopsResources.type, 'kustomization'),
        isNull(schema.gitopsResources.deletedAt),
      ),
    })

    if (!resource) {
      return
    }

    // 提取状态信息
    const status = event.status
    const conditions = status?.conditions || []
    const readyCondition = conditions.find((c: any) => c.type === 'Ready')

    let resourceStatus = 'unknown'
    let errorMessage = null
    let deploymentStatus: 'success' | 'failed' | null = null

    if (readyCondition) {
      if (readyCondition.status === 'True') {
        resourceStatus = 'ready'
        deploymentStatus = 'success'
      } else if (readyCondition.reason === 'Progressing') {
        resourceStatus = 'reconciling'
      } else {
        resourceStatus = 'failed'
        errorMessage = readyCondition.message
        deploymentStatus = 'failed'
      }
    }

    // 获取之前的状态
    const previousStatus = resource.status

    // 更新数据库
    await this.db
      .update(schema.gitopsResources)
      .set({
        status: resourceStatus,
        lastAppliedRevision: status?.lastAppliedRevision,
        lastAttemptedRevision: status?.lastAttemptedRevision,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.gitopsResources.id, resource.id))

    this.logger.log(`✅ 更新 Kustomization 状态: ${event.name} -> ${resourceStatus}`)

    // Record Kustomization metrics
    if (resourceStatus === 'ready') {
      this.metrics.recordKustomizationApply(event.name, event.namespace, 'success', 0)
    } else if (resourceStatus === 'failed') {
      this.metrics.recordKustomizationApply(event.name, event.namespace, 'failed', 0)
    }

    // Publish gitops.sync.status event
    await this.publishGitOpsSyncStatusEvent({
      resourceId: resource.id,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      status: resourceStatus as any,
      errorMessage,
      revision: status?.lastAppliedRevision,
    })

    // 如果状态从非 ready 变为 ready 或 failed，创建部署记录
    // 这表示一次完整的 reconciliation 完成
    if (
      deploymentStatus &&
      previousStatus !== resourceStatus &&
      (resourceStatus === 'ready' || resourceStatus === 'failed')
    ) {
      try {
        // 提取 commit SHA 和版本信息
        const revision = status?.lastAppliedRevision || status?.lastAttemptedRevision
        let gitCommitSha = revision
        let version: string | undefined

        // Flux revision format: "main@sha1:abc123" or "main/abc123"
        if (revision) {
          const shaMatch = revision.match(/sha1:([a-f0-9]+)/) || revision.match(/\/([a-f0-9]+)$/)
          if (shaMatch) {
            gitCommitSha = shaMatch[1]
          }
          // Extract version from revision if available
          version = gitCommitSha?.substring(0, 7)
        }

        if (!gitCommitSha) {
          this.logger.warn(`无法从 revision 提取 commit SHA: ${revision}`)
          return
        }

        // 调用 createDeploymentFromGit 创建部署记录
        // Note: This requires injecting DeploymentsService, which would create circular dependency
        // Instead, we'll emit an event or use a queue to decouple
        // For now, we'll directly insert the deployment record here

        await this.createDeploymentRecordFromFlux({
          projectId: resource.projectId,
          environmentId: resource.environmentId,
          gitopsResourceId: resource.id,
          gitCommitSha,
          version,
          status: deploymentStatus,
          errorMessage,
        })

        // Record deployment metrics
        this.metrics.recordDeployment(
          resource.projectId,
          resource.environmentId,
          'gitops-git',
          deploymentStatus,
          0,
        )

        this.logger.log(
          `✅ 创建部署记录: project=${resource.projectId}, commit=${gitCommitSha}, status=${deploymentStatus}`,
        )
      } catch (error: any) {
        this.logger.error(`创建部署记录失败:`, error)
      }
    }

    // 如果失败，可以发送通知（TODO: 集成通知服务）
    if (resourceStatus === 'failed' && errorMessage) {
      this.logger.error(`❌ Kustomization 失败: ${event.name}`, errorMessage)
    }
  }

  /**
   * 处理 HelmRelease 事件
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2
   */
  private async handleHelmReleaseEvent(event: FluxResourceEvent) {
    // 查找对应的 gitops_resources 记录
    const resource = await this.db.query.gitopsResources.findFirst({
      where: and(
        eq(schema.gitopsResources.name, event.name),
        eq(schema.gitopsResources.namespace, event.namespace),
        eq(schema.gitopsResources.type, 'helm'),
        isNull(schema.gitopsResources.deletedAt),
      ),
    })

    if (!resource) {
      return
    }

    // 提取状态信息
    const status = event.status
    const conditions = status?.conditions || []
    const readyCondition = conditions.find((c: any) => c.type === 'Ready')

    let resourceStatus = 'unknown'
    let errorMessage = null
    let deploymentStatus: 'success' | 'failed' | null = null

    if (readyCondition) {
      if (readyCondition.status === 'True') {
        resourceStatus = 'ready'
        deploymentStatus = 'success'
      } else if (
        readyCondition.reason === 'Progressing' ||
        readyCondition.reason === 'Installing' ||
        readyCondition.reason === 'Upgrading'
      ) {
        resourceStatus = 'reconciling'
      } else {
        resourceStatus = 'failed'
        errorMessage = readyCondition.message
        deploymentStatus = 'failed'
      }
    }

    // 获取之前的状态
    const previousStatus = resource.status

    // 更新数据库
    await this.db
      .update(schema.gitopsResources)
      .set({
        status: resourceStatus,
        lastAppliedRevision: status?.lastAppliedRevision,
        lastAttemptedRevision: status?.lastAttemptedRevision,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.gitopsResources.id, resource.id))

    this.logger.log(`✅ 更新 HelmRelease 状态: ${event.name} -> ${resourceStatus}`)

    // Record HelmRelease metrics
    if (resourceStatus === 'ready') {
      this.metrics.recordHelmRelease(event.name, event.namespace, 'upgrade', 'success', 0)
    } else if (resourceStatus === 'failed') {
      this.metrics.recordHelmRelease(event.name, event.namespace, 'upgrade', 'failed', 0)
    }

    // Publish gitops.sync.status event
    await this.publishGitOpsSyncStatusEvent({
      resourceId: resource.id,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      status: resourceStatus as any,
      errorMessage,
      revision: status?.lastAppliedRevision,
    })

    // 如果状态从非 ready 变为 ready 或 failed，创建部署记录
    if (
      deploymentStatus &&
      previousStatus !== resourceStatus &&
      (resourceStatus === 'ready' || resourceStatus === 'failed')
    ) {
      try {
        // 提取 chart version 和 revision
        const revision = status?.lastAppliedRevision || status?.lastAttemptedRevision
        const chartVersion =
          status?.lastAttemptedValuesChecksum || status?.history?.[0]?.chartVersion
        const gitCommitSha = revision || chartVersion || 'unknown'
        const version = chartVersion || gitCommitSha?.substring(0, 7)

        // 调用创建部署记录
        await this.createDeploymentRecordFromFlux({
          projectId: resource.projectId,
          environmentId: resource.environmentId,
          gitopsResourceId: resource.id,
          gitCommitSha,
          version,
          status: deploymentStatus,
          errorMessage,
        })

        // Record deployment metrics
        this.metrics.recordDeployment(
          resource.projectId,
          resource.environmentId,
          'gitops-git',
          deploymentStatus,
          0,
        )

        this.logger.log(
          `✅ 创建 Helm 部署记录: project=${resource.projectId}, version=${version}, status=${deploymentStatus}`,
        )
      } catch (error: any) {
        this.logger.error(`创建 Helm 部署记录失败:`, error)
      }
    }

    // 如果失败，可以发送通知（TODO: 集成通知服务）
    if (resourceStatus === 'failed' && errorMessage) {
      this.logger.error(`❌ HelmRelease 失败: ${event.name}`, errorMessage)
    }
  }

  /**
   * 创建部署记录（从 Flux 事件）
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2
   */
  private async createDeploymentRecordFromFlux(data: {
    projectId: string
    environmentId: string
    gitopsResourceId: string
    gitCommitSha: string
    version?: string
    status: 'success' | 'failed'
    errorMessage?: string | null
  }) {
    // 1. Check if deployment record already exists for this commit
    const [existingDeployment] = await this.db
      .select()
      .from(schema.deployments)
      .where(
        and(
          eq(schema.deployments.projectId, data.projectId),
          eq(schema.deployments.environmentId, data.environmentId),
          eq(schema.deployments.gitCommitSha, data.gitCommitSha),
          isNull(schema.deployments.deletedAt),
        ),
      )
      .limit(1)

    if (existingDeployment) {
      // Update existing deployment status
      await this.db
        .update(schema.deployments)
        .set({
          status: data.status,
          finishedAt: data.status === 'success' || data.status === 'failed' ? new Date() : null,
        })
        .where(eq(schema.deployments.id, existingDeployment.id))

      this.logger.log(`更新现有部署 ${existingDeployment.id} 状态为 ${data.status}`)
      return existingDeployment
    }

    // 2. Get environment info for branch
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.id, data.environmentId))
      .limit(1)

    if (!environment) {
      this.logger.warn(`环境不存在: ${data.environmentId}`)
      return null
    }

    const envConfig = environment.config as any
    const gitopsConfig = envConfig?.gitops
    const branch = gitopsConfig?.gitBranch || 'main'

    // 3. Extract version from commit SHA or use provided version
    const version = data.version || data.gitCommitSha.substring(0, 7)

    // 4. Create new deployment record with gitops-git method
    const [deployment] = await this.db
      .insert(schema.deployments)
      .values({
        projectId: data.projectId,
        environmentId: data.environmentId,
        gitopsResourceId: data.gitopsResourceId,
        version,
        commitHash: data.gitCommitSha.substring(0, 7),
        branch,
        deploymentMethod: 'gitops-git',
        gitCommitSha: data.gitCommitSha,
        deployedBy: null, // No specific user for Git-triggered deployments
        status: data.status,
        startedAt: new Date(),
        finishedAt: data.status === 'success' || data.status === 'failed' ? new Date() : null,
      })
      .returning()

    if (!deployment) {
      this.logger.error('创建部署记录失败')
      return null
    }

    this.logger.log(
      `从 Git 创建部署记录: ${deployment.id}，状态 ${data.status}，commit ${data.gitCommitSha}`,
    )

    return deployment
  }

  /**
   * 发布 GitOps 同步状态事件
   * Requirements: 11.2, 11.4
   */
  private async publishGitOpsSyncStatusEvent(data: {
    resourceId: string
    projectId: string
    environmentId: string
    status: 'ready' | 'reconciling' | 'failed' | 'unknown'
    errorMessage?: string | null
    revision?: string
  }): Promise<void> {
    try {
      const event: GitOpsSyncStatusEvent = {
        type: 'gitops.sync.status',
        resourceId: data.resourceId,
        projectId: data.projectId,
        environmentId: data.environmentId,
        status: data.status,
        errorMessage: data.errorMessage || undefined,
        revision: data.revision,
        timestamp: new Date(),
      }

      // 发布到事件队列
      await this.queue.add('gitops.sync.status', event, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      })

      this.logger.log(`Published gitops.sync.status event for resource ${data.resourceId}`)
    } catch (error) {
      this.logger.error(`Failed to publish gitops.sync.status event:`, error)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取监听状态
   */
  getWatcherStatus(): {
    isWatching: boolean
    watchers: string[]
  } {
    return {
      isWatching: this.isWatching,
      watchers: Array.from(this.watchers.keys()),
    }
  }
}
