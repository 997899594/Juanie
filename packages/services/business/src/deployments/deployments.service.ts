import * as schema from '@juanie/core/database'
import { DEPLOYMENT_QUEUE } from '@juanie/core/queue'
import { DATABASE } from '@juanie/core/tokens'
import type {
  ApproveDeploymentInput,
  CreateDeploymentInput,
  DeploymentCompletedEvent,
  RejectDeploymentInput,
} from '@juanie/types'
import type { DeploymentChanges } from '../gitops/git-ops/git-ops.service'
import { GitOpsService } from '../gitops/git-ops/git-ops.service'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import type { Queue } from 'bullmq'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export interface DeployWithGitOpsInput {
  projectId: string
  environmentId: string
  gitopsResourceId?: string
  version: string
  changes: DeploymentChanges
  commitMessage?: string
}

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(DEPLOYMENT_QUEUE) private queue: Queue,
    private gitOpsService: GitOpsService,
  ) {}

  // 创建部署
  async create(userId: string, data: CreateDeploymentInput) {
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

    if (!deployment) {
      throw new Error('创建部署失败')
    }

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

  /**
   * Deploy with GitOps - UI to Git workflow
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3
   */
  async deployWithGitOps(userId: string, data: DeployWithGitOpsInput) {
    this.logger.log(
      `Starting GitOps deployment for project ${data.projectId}, environment ${data.environmentId}`,
    )

    // 1. Check permissions
    const hasPermission = await this.checkDeployPermission(
      userId,
      data.projectId,
      data.environmentId,
    )
    if (!hasPermission) {
      throw new Error('没有权限创建部署')
    }

    // 2. Check if environment requires approval
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.id, data.environmentId))
      .limit(1)

    if (!environment) {
      throw new Error('环境不存在')
    }

    // 3. Verify GitOps is enabled for this environment
    const envConfig = environment.config as any
    const gitopsConfig = envConfig?.gitops

    if (!gitopsConfig?.enabled) {
      throw new Error('该环境未启用 GitOps')
    }

    // 4. Call GitOpsService to commit changes to Git
    let gitCommitSha: string
    try {
      gitCommitSha = await this.gitOpsService.commitFromUI({
        projectId: data.projectId,
        environmentId: data.environmentId,
        changes: data.changes,
        userId,
        commitMessage: data.commitMessage,
      })

      this.logger.log(`Git commit created: ${gitCommitSha}`)
    } catch (error) {
      this.logger.error('Failed to commit changes to Git:', error)
      throw new Error(`GitOps commit 失败: ${(error instanceof Error ? error.message : String(error))}`)
    }

    // 5. Extract version from changes (use image tag or provided version)
    let version = data.version
    if (data.changes.image && !version) {
      // Extract version from image tag (e.g., "myapp:v1.2.3" -> "v1.2.3")
      const imageParts = data.changes.image.split(':')
      version = imageParts.length > 1 ? imageParts[1]! : 'latest'
    }

    // 6. Create deployment record with gitops-ui method
    const [deployment] = await this.db
      .insert(schema.deployments)
      .values({
        projectId: data.projectId,
        environmentId: data.environmentId,
        gitopsResourceId: data.gitopsResourceId || null,
        version,
        commitHash: gitCommitSha.substring(0, 7), // Short SHA for display
        branch: gitopsConfig.gitBranch || 'main',
        deploymentMethod: 'gitops-ui',
        gitCommitSha, // Full SHA for GitOps tracking
        deployedBy: userId,
        status: 'pending',
      })
      .returning()

    if (!deployment) {
      throw new Error('创建部署记录失败')
    }

    this.logger.log(`Deployment record created: ${deployment.id}`)

    // 7. If environment requires approval, create approval request
    const requiresApproval = environment.type === 'production'
    if (requiresApproval) {
      await this.createApprovalRequest(deployment.id, data.projectId)
      this.logger.log(`Approval request created for deployment ${deployment.id}`)
    } else {
      // For non-production environments, mark as running immediately
      // Flux will handle the actual deployment
      await this.db
        .update(schema.deployments)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(schema.deployments.id, deployment.id))

      this.logger.log(`Deployment ${deployment.id} marked as running, waiting for Flux`)
    }

    return deployment
  }

  /**
   * Create deployment record from Git push (Flux reconciliation)
   * This is called by the Flux watcher when a reconciliation completes
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2
   */
  async createDeploymentFromGit(data: {
    projectId: string
    environmentId: string
    gitopsResourceId: string
    gitCommitSha: string
    version?: string
    status: 'success' | 'failed'
    errorMessage?: string
  }) {
    this.logger.log(
      `Creating deployment record from Git for project ${data.projectId}, commit ${data.gitCommitSha}`,
    )

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

      this.logger.log(`Updated existing deployment ${existingDeployment.id} to ${data.status}`)
      return existingDeployment
    }

    // 2. Get environment info for branch
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.id, data.environmentId))
      .limit(1)

    if (!environment) {
      throw new Error('环境不存在')
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
      throw new Error('创建部署记录失败')
    }

    this.logger.log(
      `Deployment record created from Git: ${deployment.id} with status ${data.status}`,
    )

    // 5. Record to audit log (TODO: integrate with audit service)
    // await this.auditService.log({
    //   action: 'gitops.deployment.created',
    //   resourceType: 'deployment',
    //   resourceId: deployment.id,
    //   metadata: {
    //     method: 'gitops-git',
    //     commitSha: data.gitCommitSha,
    //     status: data.status,
    //   },
    // })

    // 6. Publish deployment.completed event if deployment is finished
    if (data.status === 'success' || data.status === 'failed') {
      await this.publishDeploymentCompletedEvent(deployment, data.status)
    }

    return deployment
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
  async approve(userId: string, deploymentId: string, data: ApproveDeploymentInput) {
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
        comments: data.comment,
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
  async reject(userId: string, deploymentId: string, data: RejectDeploymentInput) {
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
        comments: data.reason,
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
      this.logger.error('Deployment failed', error)
    })
  }

  // 模拟部署过程
  private async simulateDeployment(deploymentId: string) {
    // 模拟部署延迟
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 获取部署信息
    const [deployment] = await this.db
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.id, deploymentId))
      .limit(1)

    if (!deployment) {
      return
    }

    // 更新为成功状态
    await this.db
      .update(schema.deployments)
      .set({
        status: 'success',
        finishedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId))

    // 发布 deployment.completed 事件
    await this.publishDeploymentCompletedEvent(deployment, 'success')
  }

  /**
   * 发布部署完成事件
   * Requirements: 11.2, 11.4
   */
  private async publishDeploymentCompletedEvent(
    deployment: typeof schema.deployments.$inferSelect,
    status: 'success' | 'failed',
  ): Promise<void> {
    try {
      const event: DeploymentCompletedEvent = {
        type: 'deployment.completed',
        deploymentId: deployment.id,
        projectId: deployment.projectId,
        environmentId: deployment.environmentId,
        status,
        timestamp: new Date(),
        errorMessage: status === 'failed' ? 'Deployment failed' : undefined,
      }

      // 发布到事件队列
      await this.queue.add('deployment.completed', event, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      })

      this.logger.log(`Published deployment.completed event for deployment ${deployment.id}`)
    } catch (error) {
      this.logger.error(`Failed to publish deployment.completed event:`, error)
      // 不抛出错误，避免影响主流程
    }
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
