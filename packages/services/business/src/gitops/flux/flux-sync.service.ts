import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { K3sService } from '../k3s/k3s.service'
import { FluxCliService } from './flux-cli.service'
import { FluxMetricsService } from './flux-metrics.service'

/**
 * FluxSyncService
 *
 * 职责：管理 Flux 资源的同步和协调
 * - 触发 reconciliation
 * - 同步资源状态
 * - 等待资源就绪
 * - 获取事件
 */
@Injectable()
export class FluxSyncService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private k3s: K3sService,
    private fluxCli: FluxCliService,
    private metrics: FluxMetricsService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(FluxSyncService.name)
  }

  /**
   * 手动触发 reconciliation
   */
  async triggerReconciliation(kind: string, name: string, namespace: string): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      throw new Error('K3s 未连接')
    }

    const startTime = Date.now()

    try {
      await this.fluxCli.reconcile(kind, name, namespace)

      const duration = (Date.now() - startTime) / 1000
      this.metrics.recordReconciliation(kind, name, namespace, 'success', duration)
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000
      this.metrics.recordReconciliation(kind, name, namespace, 'failed', duration)
      throw error
    }
  }

  /**
   * 同步项目 GitOps 资源状态
   * 从 K8s 集群读取实际状态并更新数据库
   */
  async syncProjectGitOpsStatus(projectId: string): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      return
    }

    try {
      const resources = await this.db
        .select()
        .from(schema.gitopsResources)
        .where(eq(schema.gitopsResources.projectId, projectId))

      for (const resource of resources) {
        try {
          let status: 'pending' | 'ready' | 'failed' = 'pending'

          if (resource.type === 'git-repository') {
            const k8sResource = await this.getK3sResource(
              'source.toolkit.fluxcd.io',
              'v1',
              resource.namespace,
              'gitrepositories',
              resource.name,
            )
            const parsedStatus = this.parseResourceStatus(k8sResource)
            status = parsedStatus === 'reconciling' ? 'pending' : parsedStatus
          } else if (resource.type === 'kustomization') {
            const k8sResource = await this.getK3sResource(
              'kustomize.toolkit.fluxcd.io',
              'v1',
              resource.namespace,
              'kustomizations',
              resource.name,
            )
            const parsedStatus = this.parseResourceStatus(k8sResource)
            status = parsedStatus === 'reconciling' ? 'pending' : parsedStatus
          }

          await this.db
            .update(schema.gitopsResources)
            .set({ status, updatedAt: new Date() })
            .where(eq(schema.gitopsResources.id, resource.id))
        } catch (error) {
          this.logger.error(`Failed to sync status for resource ${resource.name}:`, error)
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to sync GitOps status:', error)
    }
  }

  /**
   * 获取项目的 GitOps 资源摘要
   */
  async getProjectGitOpsSummary(projectId: string): Promise<{
    namespaces: number
    gitRepositories: number
    kustomizations: number
    healthyResources: number
    totalResources: number
  }> {
    const resources = await this.db
      .select()
      .from(schema.gitopsResources)
      .where(eq(schema.gitopsResources.projectId, projectId))

    const gitRepositories = resources.filter((r) => r.type === 'git-repository')
    const kustomizations = resources.filter((r) => r.type === 'kustomization')
    const healthyResources = resources.filter((r) => r.status === 'ready')

    const uniqueNamespaces = new Set(resources.map((r) => r.namespace))

    return {
      namespaces: uniqueNamespaces.size,
      gitRepositories: gitRepositories.length,
      kustomizations: kustomizations.length,
      healthyResources: healthyResources.length,
      totalResources: resources.length,
    }
  }

  /**
   * 等待 GitRepository 就绪
   */
  async waitForGitRepositoryReady(
    name: string,
    namespace: string,
    timeout: number,
  ): Promise<'ready' | 'reconciling' | 'failed'> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const resource = await this.getK3sResource(
          'source.toolkit.fluxcd.io',
          'v1',
          namespace,
          'gitrepositories',
          name,
        )

        const status = this.parseResourceStatus(resource)
        if (status === 'ready' || status === 'failed') {
          return status
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (_error) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    return 'reconciling'
  }

  /**
   * 等待 Kustomization 就绪
   */
  async waitForKustomizationReady(
    name: string,
    namespace: string,
    timeout: number,
  ): Promise<'ready' | 'reconciling' | 'failed'> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const resource = await this.getK3sResource(
          'kustomize.toolkit.fluxcd.io',
          'v1',
          namespace,
          'kustomizations',
          name,
        )

        const status = this.parseResourceStatus(resource)
        if (status === 'ready' || status === 'failed') {
          return status
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (_error) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    return 'reconciling'
  }

  /**
   * 获取项目的 Flux 事件
   */
  async getEvents(projectId: string, limit = 50): Promise<any[]> {
    if (!this.k3s.isK3sConnected()) {
      return []
    }

    try {
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(
          and(eq(schema.environments.projectId, projectId), isNull(schema.environments.deletedAt)),
        )

      const namespaces = environments.map((env) => `project-${projectId}-${env.type}`)

      const allEvents: any[] = []

      for (const namespace of namespaces) {
        try {
          const events = await this.k3s.getEvents(namespace)
          allEvents.push(...events)
        } catch (_error) {
          // Namespace 可能不存在，继续处理其他 namespace
        }
      }

      return allEvents
        .sort((a, b) => {
          const timeA = new Date(a.lastTimestamp || a.metadata?.creationTimestamp || 0).getTime()
          const timeB = new Date(b.lastTimestamp || b.metadata?.creationTimestamp || 0).getTime()
          return timeB - timeA
        })
        .slice(0, limit)
    } catch (error: any) {
      throw new Error(`Failed to get events: ${error.message}`)
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取 K8s 自定义资源
   */
  private async getK3sResource(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string,
  ): Promise<any> {
    const client = this.k3s.getCustomObjectsApi()
    const response = await client.getNamespacedCustomObject({
      group,
      version,
      namespace,
      plural,
      name,
    })
    return response
  }

  /**
   * 解析资源状态
   */
  private parseResourceStatus(resource: any): 'ready' | 'reconciling' | 'failed' {
    const conditions = resource.status?.conditions || []

    const readyCondition = conditions.find((c: any) => c.type === 'Ready')

    if (!readyCondition) {
      return 'reconciling'
    }

    if (readyCondition.status === 'True') {
      return 'ready'
    }

    if (readyCondition.reason === 'Failed' || readyCondition.reason === 'Error') {
      return 'failed'
    }

    return 'reconciling'
  }
}
