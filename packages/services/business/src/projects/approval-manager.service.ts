import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DATABASE } from '@juanie/core-tokens'
import { AuditLogsService } from '@juanie/service-extensions'
import { DeploymentsService } from '../deployments/deployments.service'
import { NotificationsService } from '@juanie/service-extensions'
import { Inject, Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, eq, lt } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

interface ApprovalResult {
  success: boolean
  allApproved?: boolean
  rejected?: boolean
}

@Injectable()
export class ApprovalManager {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private deploymentsService: DeploymentsService,
    private notificationsService: NotificationsService,
    private auditLogsService: AuditLogsService,
  ) {}

  /**
   * 创建审批请求
   * 为每个审批人创建一条 approval 记录
   */
  @Trace('approval-manager.createApprovalRequest')
  async createApprovalRequest(deploymentId: string, approvers: string[]): Promise<void> {
    if (!approvers || approvers.length === 0) {
      throw new Error('审批人列表不能为空')
    }

    // 为每个审批人创建一条记录
    for (const approverId of approvers) {
      await this.db.insert(schema.deploymentApprovals).values({
        deploymentId,
        approverId,
        status: 'pending',
      })
    }

    // 发送审批通知给所有审批人
    const deployment = await this.getDeployment(deploymentId)
    if (!deployment) {
      throw new Error('部署不存在')
    }

    for (const approverId of approvers) {
      await this.notificationsService.create({
        userId: approverId,
        type: 'approval',
        title: '部署审批请求',
        message: `项目 "${deployment.projectId}" 的部署需要您的审批`,
        priority: 'high',
      })
    }
  }

  /**
   * 批准部署
   */
  @Trace('approval-manager.approve')
  async approve(approvalId: string, approverId: string, comment?: string): Promise<ApprovalResult> {
    // 更新该审批人的记录
    const [updated] = await this.db
      .update(schema.deploymentApprovals)
      .set({
        status: 'approved',
        comments: comment,
        decidedAt: new Date(),
      })
      .where(
        and(
          eq(schema.deploymentApprovals.id, approvalId),
          eq(schema.deploymentApprovals.approverId, approverId),
        ),
      )
      .returning()

    if (!updated) {
      throw new Error('审批记录不存在或无权限')
    }

    // 记录审计日志
    const deployment = await this.getDeployment(updated.deploymentId)
    if (deployment) {
      await this.auditLogsService.log({
        userId: approverId,
        action: 'deployment.approval.approved',
        resourceType: 'deployment',
        resourceId: updated.deploymentId,
        metadata: {
          approvalId,
          comment,
          projectId: deployment.projectId,
        },
      })
    }

    // 检查是否所有审批都完成
    const allApproved = await this.checkAllApproved(updated.deploymentId)

    if (allApproved) {
      // 执行部署
      await this.executeDeployment(updated.deploymentId)

      // 通知申请人
      if (deployment?.deployedBy) {
        await this.notificationsService.create({
          userId: deployment.deployedBy,
          type: 'deployment',
          title: '部署已批准',
          message: `您的部署请求已获得批准，正在执行部署`,
          priority: 'normal',
        })
      }
    }

    return { success: true, allApproved }
  }

  /**
   * 拒绝部署
   */
  @Trace('approval-manager.reject')
  async reject(approvalId: string, approverId: string, reason: string): Promise<ApprovalResult> {
    if (!reason || reason.trim() === '') {
      throw new Error('拒绝原因不能为空')
    }

    // 更新该审批人的记录
    const [updated] = await this.db
      .update(schema.deploymentApprovals)
      .set({
        status: 'rejected',
        comments: reason,
        decidedAt: new Date(),
      })
      .where(
        and(
          eq(schema.deploymentApprovals.id, approvalId),
          eq(schema.deploymentApprovals.approverId, approverId),
        ),
      )
      .returning()

    if (!updated) {
      throw new Error('审批记录不存在或无权限')
    }

    // 记录审计日志
    const deployment = await this.getDeployment(updated.deploymentId)
    if (deployment) {
      await this.auditLogsService.log({
        userId: approverId,
        action: 'deployment.approval.rejected',
        resourceType: 'deployment',
        resourceId: updated.deploymentId,
        metadata: {
          approvalId,
          reason,
          projectId: deployment.projectId,
        },
      })
    }

    // 任何一个拒绝，整个部署失败
    await this.failDeployment(updated.deploymentId, reason)

    // 通知申请人
    if (deployment?.deployedBy) {
      await this.notificationsService.create({
        userId: deployment.deployedBy,
        type: 'deployment',
        title: '部署已拒绝',
        message: `您的部署请求已被拒绝。原因：${reason}`,
        priority: 'high',
      })
    }

    return { success: true, rejected: true }
  }

  /**
   * 检查是否所有审批都完成
   */
  @Trace('approval-manager.checkAllApproved')
  async checkAllApproved(deploymentId: string): Promise<boolean> {
    const approvals = await this.db.query.deploymentApprovals.findMany({
      where: eq(schema.deploymentApprovals.deploymentId, deploymentId),
    })

    if (approvals.length === 0) {
      return false
    }

    // 如果有任何一个拒绝，返回 false
    if (approvals.some((a) => a.status === 'rejected')) {
      return false
    }

    // 如果所有都批准，返回 true
    return approvals.every((a) => a.status === 'approved')
  }

  /**
   * 检查是否需要审批
   */
  @Trace('approval-manager.requiresApproval')
  async requiresApproval(projectId: string, environmentId: string): Promise<boolean> {
    const environment = await this.db.query.environments.findFirst({
      where: eq(schema.environments.id, environmentId),
    })

    // 生产环境需要审批
    return environment?.type === 'production'
  }

  /**
   * 获取审批人列表（项目的管理员）
   */
  @Trace('approval-manager.getApprovers')
  async getApprovers(projectId: string): Promise<string[]> {
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) {
      throw new Error('项目不存在')
    }

    const admins = await this.db.query.organizationMembers.findMany({
      where: and(
        eq(schema.organizationMembers.organizationId, project.organizationId),
        eq(schema.organizationMembers.role, 'admin'),
      ),
    })

    return admins.map((a) => a.userId)
  }

  /**
   * 审批超时检查（定时任务）
   * 每小时执行一次，检查超过 24 小时未响应的审批
   */
  @Cron('0 * * * *') // 每小时执行一次
  @Trace('approval-manager.checkApprovalTimeouts')
  async checkApprovalTimeouts(): Promise<void> {
    const timeoutThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 小时

    const timedOutApprovals = await this.db.query.deploymentApprovals.findMany({
      where: and(
        eq(schema.deploymentApprovals.status, 'pending'),
        lt(schema.deploymentApprovals.createdAt, timeoutThreshold),
      ),
    })

    for (const approval of timedOutApprovals) {
      // 自动拒绝
      await this.db
        .update(schema.deploymentApprovals)
        .set({
          status: 'rejected',
          comments: '审批超时（24 小时未响应），已自动拒绝',
          decidedAt: new Date(),
        })
        .where(eq(schema.deploymentApprovals.id, approval.id))

      // 更新部署状态
      await this.failDeployment(approval.deploymentId, '审批超时')

      // 获取部署信息
      const deployment = await this.getDeployment(approval.deploymentId)

      // 通知申请人
      if (deployment?.deployedBy) {
        await this.notificationsService.create({
          userId: deployment.deployedBy,
          type: 'approval',
          title: '部署审批超时',
          message: '部署审批超时（24 小时未响应），已自动拒绝',
          priority: 'high',
        })
      }

      // 记录审计日志
      if (deployment) {
        await this.auditLogsService.log({
          action: 'deployment.approval.timeout',
          resourceType: 'deployment',
          resourceId: approval.deploymentId,
          metadata: {
            approvalId: approval.id,
            approverId: approval.approverId,
            projectId: deployment.projectId,
          },
        })
      }
    }
  }

  /**
   * 获取部署的审批状态
   */
  @Trace('approval-manager.getApprovalStatus')
  async getApprovalStatus(deploymentId: string) {
    const approvals = await this.db.query.deploymentApprovals.findMany({
      where: eq(schema.deploymentApprovals.deploymentId, deploymentId),
      with: {
        approver: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    const totalApprovers = approvals.length
    const approvedCount = approvals.filter((a) => a.status === 'approved').length
    const rejectedCount = approvals.filter((a) => a.status === 'rejected').length
    const pendingCount = approvals.filter((a) => a.status === 'pending').length

    return {
      approvals,
      summary: {
        total: totalApprovers,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
        isComplete: pendingCount === 0,
        isApproved: rejectedCount === 0 && approvedCount === totalApprovers,
        isRejected: rejectedCount > 0,
      },
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 获取部署信息
   */
  private async getDeployment(deploymentId: string) {
    return await this.db.query.deployments.findFirst({
      where: eq(schema.deployments.id, deploymentId),
    })
  }

  /**
   * 执行部署
   */
  private async executeDeployment(deploymentId: string): Promise<void> {
    // 更新部署状态为 running
    await this.db
      .update(schema.deployments)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId))

    // 注意：实际的部署执行逻辑应该由 DeploymentsService 处理
    // 这里只是触发部署流程
    // 在真实场景中，可能需要调用 deploymentsService.execute(deploymentId)
  }

  /**
   * 标记部署失败
   */
  private async failDeployment(deploymentId: string, reason: string): Promise<void> {
    await this.db
      .update(schema.deployments)
      .set({
        status: 'failed',
        finishedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId))
  }
}
