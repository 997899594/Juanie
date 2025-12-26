import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'

/**
 * GitOps 资源服务 (Foundation 层)
 *
 * 管理 gitopsResources 表的 CRUD 操作
 * 提供给 Business 层使用
 */
@Injectable()
export class GitOpsResourcesService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitOpsResourcesService.name)
  }

  /**
   * 创建 GitOps 资源记录
   */
  async create(data: {
    projectId: string
    environmentId: string
    repositoryId: string
    type: 'git-repository' | 'kustomization' | 'helm-release'
    name: string
    namespace: string
    config: any
    status: 'pending' | 'ready' | 'failed'
  }) {
    const [resource] = await this.db
      .insert(schema.gitopsResources)
      .values({
        projectId: data.projectId,
        environmentId: data.environmentId,
        repositoryId: data.repositoryId,
        type: data.type,
        name: data.name,
        namespace: data.namespace,
        config: data.config,
        status: data.status,
      })
      .returning()

    return resource
  }

  /**
   * 查找项目的所有 GitOps 资源
   */
  async findByProject(projectId: string) {
    return this.db.query.gitopsResources.findMany({
      where: and(
        eq(schema.gitopsResources.projectId, projectId),
        isNull(schema.gitopsResources.deletedAt),
      ),
      orderBy: [schema.gitopsResources.createdAt],
    })
  }

  /**
   * 查找单个 GitOps 资源
   */
  async findById(id: string) {
    return this.db.query.gitopsResources.findFirst({
      where: and(eq(schema.gitopsResources.id, id), isNull(schema.gitopsResources.deletedAt)),
    })
  }

  /**
   * 更新 GitOps 资源
   */
  async update(
    id: string,
    data: {
      config?: any
      status?: 'pending' | 'ready' | 'failed'
      errorMessage?: string
    },
  ) {
    const [updated] = await this.db
      .update(schema.gitopsResources)
      .set({
        config: data.config,
        status: data.status,
        errorMessage: data.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.gitopsResources.id, id))
      .returning()

    return updated
  }

  /**
   * 软删除 GitOps 资源
   */
  async softDelete(id: string) {
    await this.db
      .update(schema.gitopsResources)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.gitopsResources.id, id))
  }

  /**
   * 按类型查找资源
   */
  async findByType(projectId: string, type: 'git-repository' | 'kustomization' | 'helm-release') {
    return this.db
      .select()
      .from(schema.gitopsResources)
      .where(
        and(
          eq(schema.gitopsResources.projectId, projectId),
          eq(schema.gitopsResources.type, type),
          isNull(schema.gitopsResources.deletedAt),
        ),
      )
  }

  /**
   * 获取资源摘要
   */
  async getSummary(projectId: string) {
    const resources = await this.findByProject(projectId)

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
}
