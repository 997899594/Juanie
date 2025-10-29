import * as schema from '@juanie/core-database/schemas'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { DATABASE } from '@/database/database.module'
import { K3sService } from '@/modules/k3s/k3s.service'

@Injectable()
export class DeploymentsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private k3sService: K3sService,
  ) {}

  // 创建部署
  async create(
    userId: string,
    data: {
      projectId: string
      environmentId: string
      pipelineRunId?: string
      version: string
      commitHash: string
      branch: string
      strategy?: 'rolling' | 'blue_green' | 'canary'
    },
  ) {
    // 检查权限
    const hasPermission = await this.checkDeployPermission(
      userId,
      data.projectId,
      data.environmentId,
    )
    if (!hasPermission) {
      throw new Error('没有权限创建部署')
    }

    // 检查环境是否需要审批
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.id, data.environmentId))
      .limit(1)

    if (!environment) {
      throw new Error('环境不存在')
    }

    const [deployment] = await this.db
      .insert(schema.deployments)
      .values({
        ...data,
        deployedBy: userId,
        status: 'pending',
      })
      .returning()

    // 如果环境需要审批，创建审批请求
    const requiresApproval = environment.type === 'production'
    if (requiresApproval) {
      await this.createApprovalRequest(deployment.id, data.projectId)
    }

    return deployment
  }

  // 列出部署记录
  async list(
    userId: string,
    filters: {
      projectId?: string
      environmentId?: string
      status?: string
    },
  ) {
    const conditions = [isNull(schema.deployments.deletedAt)]

    if (filters.projectId) {
      const hasAccess = await this.checkProjectAccess(userId, filters.projectId)
      if (!hasAccess) {
        throw new Error('没有权限访问该项目')
      }
      conditions.push(eq(schema.deployments.projectId, filters.projectId))
    }

    if (filters.environmentId) {
      conditions.push(eq(schema.deployments.environmentId, filters.environmentId))
    }

    if (filters.status) {
      conditions.push(eq(schema.deployments.status, filters.status))
    }

    const deployments = await this.db
      .select()
      .from(schema.deployments)
      .where(and(...conditions))
      .orderBy(desc(schema.deployments.createdAt))
      .limit(50)

    return deployments
  }

  // 获取部署详情
  async get(userId: string, deploymentId: string) {
    const [deployment] = await this.db
      .select()
      .from(schema.deployments)
      .where(and(eq(schema.deployments.id, deploymentId), isNull(schema.deployments.deletedAt)))
      .limit(1)

    if (!deployment) {
      return null
    }

    const hasAccess = await this.checkProjectAccess(userId, deployment.projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该部署')
    }

    return deployment
  }

  // 回滚部署
  async rollback(userId: string, deploymentId: string) {
    const deployment = await this.get(userId, deploymentId)
    if (!deployment) {
      throw new Error('部署不存在')
    }

    const hasPermission = await this.checkDeployPermission(
      userId,
      deployment.projectId,
      deployment.environmentId,
    )
    if (!hasPermission) {
      throw new Error('没有权限回滚部署')
    }

    // 查找上一个成功的部署
    const [previousDeployment] = await this.db
      .select()
      .from(schema.deployments)
      .where(
        and(
          eq(schema.deployments.projectId, deployment.projectId),
          eq(schema.deployments.environmentId, deployment.environmentId),
          eq(schema.deployments.status, 'success'),
          isNull(schema.deployments.deletedAt),
        ),
      )
      .orderBy(desc(schema.deployments.createdAt))
      .limit(1)

    if (!previousDeployment) {
      throw new Error('没有可回滚的部署')
    }

    // 创建新的部署记录（回滚）
    const [rollbackDeployment] = await this.db
      .insert(schema.deployments)
      .values({
        projectId: deployment.projectId,
        environmentId: deployment.environmentId,
        version: previousDeployment.version,
        commitHash: previousDeployment.commitHash,
        branch: previousDeployment.branch,
        strategy: deployment.strategy,
        deployedBy: userId,
        status: 'pending',
      })
      .returning()

    // 更新原部署状态
    await this.db
      .update(schema.deployments)
      .set({ status: 'rolled_back' })
      .where(eq(schema.deployments.id, deploymentId))

    return rollbackDeployment
  }

  // 创建审批请求
  private async createApprovalRequest(deploymentId: string, projectId: string) {
    // 获取项目的管理员
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return
    }

    const admins = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.role, 'admin'),
        ),
      )

    // 为每个管理员创建审批请求
    for (const admin of admins) {
      await this.db.insert(schema.deploymentApprovals).values({
        deploymentId,
        approverId: admin.userId,
        status: 'pending',
      })
    }
  }

  // 批准部署
  async approve(userId: string, deploymentId: string, comments?: string) {
    const deployment = await this.get(userId, deploymentId)
    if (!deployment) {
      throw new Error('部署不存在')
    }

    // 检查是否有审批权限
    const [approval] = await this.db
      .select()
      .from(schema.deploymentApprovals)
      .where(
        and(
          eq(schema.deploymentApprovals.deploymentId, deploymentId),
          eq(schema.deploymentApprovals.approverId, userId),
          eq(schema.deploymentApprovals.status, 'pending'),
        ),
      )
      .limit(1)

    if (!approval) {
      throw new Error('没有审批权限或已审批')
    }

    // 更新审批状态
    await this.db
      .update(schema.deploymentApprovals)
      .set({
        status: 'approved',
        comments,
        decidedAt: new Date(),
      })
      .where(eq(schema.deploymentApprovals.id, approval.id))

    // 检查是否所有审批都已完成
    const allApprovals = await this.db
      .select()
      .from(schema.deploymentApprovals)
      .where(eq(schema.deploymentApprovals.deploymentId, deploymentId))

    const allApproved = allApprovals.every((a) => a.status === 'approved')

    if (allApproved) {
      // 执行部署
      await this.executeDeploy(deploymentId)
    }

    return { success: true }
  }

  // 拒绝部署
  async reject(userId: string, deploymentId: string, comments?: string) {
    const deployment = await this.get(userId, deploymentId)
    if (!deployment) {
      throw new Error('部署不存在')
    }

    // 检查是否有审批权限
    const [approval] = await this.db
      .select()
      .from(schema.deploymentApprovals)
      .where(
        and(
          eq(schema.deploymentApprovals.deploymentId, deploymentId),
          eq(schema.deploymentApprovals.approverId, userId),
          eq(schema.deploymentApprovals.status, 'pending'),
        ),
      )
      .limit(1)

    if (!approval) {
      throw new Error('没有审批权限或已审批')
    }

    // 更新审批状态
    await this.db
      .update(schema.deploymentApprovals)
      .set({
        status: 'rejected',
        comments,
        decidedAt: new Date(),
      })
      .where(eq(schema.deploymentApprovals.id, approval.id))

    // 更新部署状态为失败
    await this.db
      .update(schema.deployments)
      .set({
        status: 'failed',
        finishedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId))

    return { success: true }
  }

  // 执行部署
  private async executeDeploy(deploymentId: string) {
    // 更新部署状态为运行中
    await this.db
      .update(schema.deployments)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId))

    // 这里应该触发实际的部署执行
    // 在真实场景中，这里会：
    // 1. 调用 Kubernetes API 或其他部署平台
    // 2. 使用消息队列异步处理
    // 3. 通过 webhook 回调更新状态
    // 简化实现：模拟异步部署过程
    this.simulateDeployment(deploymentId).catch((error) => {
      console.error('Deployment failed:', error)
    })
  }

  // 模拟部署过程
  private async simulateDeployment(deploymentId: string) {
    // 模拟部署延迟
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 更新为成功状态
    await this.db
      .update(schema.deployments)
      .set({
        status: 'success',
        finishedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId))
  }

  // 辅助方法：检查项目访问权限
  private async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember) {
      return true
    }

    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!projectMember
  }

  // 辅助方法：检查部署权限
  private async checkDeployPermission(
    userId: string,
    projectId: string,
    environmentId: string,
  ): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember && ['owner', 'admin'].includes(orgMember.role)) {
      return true
    }

    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return projectMember?.role === 'admin'
  }
}
