import * as schema from '@juanie/core/database'
import { PIPELINE_QUEUE } from '@juanie/core/queue'
import { DATABASE } from '@juanie/core/tokens'
import { generateId } from '@juanie/core/utils'
import type {
  CreatePipelineInput,
  TriggerPipelineInput,
  UpdatePipelineInput,
} from '@juanie/core-types'
import { Inject, Injectable } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { and, desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class PipelinesService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(PIPELINE_QUEUE) private pipelineQueue: Queue,
  ) {}

  // 创建 Pipeline
  async create(userId: string, data: CreatePipelineInput) {
    // 检查权限
    const hasPermission = await this.checkProjectPermission(userId, data.projectId)
    if (!hasPermission) {
      throw new Error('没有权限创建 Pipeline')
    }

    const [pipeline] = await this.db
      .insert(schema.pipelines)
      .values({
        projectId: data.projectId,
        name: data.name,
        config: data.config,
      })
      .returning()

    return pipeline
  }

  // 列出项目的 Pipelines
  async list(userId: string, projectId: string) {
    const hasAccess = await this.checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该项目')
    }

    const pipelines = await this.db
      .select()
      .from(schema.pipelines)
      .where(eq(schema.pipelines.projectId, projectId))

    return pipelines
  }

  // 获取 Pipeline 详情
  async get(userId: string, pipelineId: string) {
    const [pipeline] = await this.db
      .select()
      .from(schema.pipelines)
      .where(eq(schema.pipelines.id, pipelineId))
      .limit(1)

    if (!pipeline) {
      return null
    }

    const hasAccess = await this.checkProjectAccess(userId, pipeline.projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该 Pipeline')
    }

    return pipeline
  }

  // 更新 Pipeline
  async update(userId: string, pipelineId: string, data: UpdatePipelineInput) {
    const pipeline = await this.get(userId, pipelineId)
    if (!pipeline) {
      throw new Error('Pipeline 不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, pipeline.projectId)
    if (!hasPermission) {
      throw new Error('没有权限更新 Pipeline')
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name

    // 只有当 config 完整时才更新
    if (data.config && data.config.triggers && data.config.stages) {
      updateData.config = data.config
    }

    const [updated] = await this.db
      .update(schema.pipelines)
      .set(updateData)
      .where(eq(schema.pipelines.id, pipelineId))
      .returning()

    return updated
  }

  // 删除 Pipeline
  async delete(userId: string, pipelineId: string) {
    const pipeline = await this.get(userId, pipelineId)
    if (!pipeline) {
      throw new Error('Pipeline 不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, pipeline.projectId)
    if (!hasPermission) {
      throw new Error('没有权限删除 Pipeline')
    }

    await this.db.delete(schema.pipelines).where(eq(schema.pipelines.id, pipelineId))

    return { success: true }
  }

  // 手动触发 Pipeline
  async trigger(userId: string, pipelineId: string, data: TriggerPipelineInput) {
    const pipeline = await this.get(userId, pipelineId)
    if (!pipeline) {
      throw new Error('Pipeline 不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, pipeline.projectId)
    if (!hasPermission) {
      throw new Error('没有权限触发 Pipeline')
    }

    // 创建 Pipeline Run
    const runId = generateId()
    const [run] = await this.db
      .insert(schema.pipelineRuns)
      .values({
        id: runId,
        pipelineId,
        projectId: pipeline.projectId,
        trigger: 'manual',
        status: 'queued', // 改为 queued 状态
        branch: data.branch || 'main',
        commitHash: data.commitHash || 'HEAD',
      })
      .returning()

    // 添加到 BullMQ 队列（异步执行）
    await this.pipelineQueue.add(
      'execute-pipeline',
      {
        pipelineId,
        runId,
        config: pipeline.config,
        branch: data.branch || 'main',
        commitHash: data.commitHash || 'HEAD',
      },
      {
        attempts: 3, // 失败重试 3 次
        backoff: {
          type: 'exponential',
          delay: 2000, // 2秒后重试
        },
        removeOnComplete: false, // 保留完成的任务
        removeOnFail: false, // 保留失败的任务
      },
    )

    return run
  }

  // 取消 Pipeline Run
  async cancel(userId: string, runId: string) {
    const [run] = await this.db
      .select()
      .from(schema.pipelineRuns)
      .where(eq(schema.pipelineRuns.id, runId))
      .limit(1)

    if (!run) {
      throw new Error('Pipeline Run 不存在')
    }

    const [pipeline] = await this.db
      .select()
      .from(schema.pipelines)
      .where(eq(schema.pipelines.id, run.pipelineId))
      .limit(1)

    if (!pipeline) {
      throw new Error('Pipeline 不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, pipeline.projectId)
    if (!hasPermission) {
      throw new Error('没有权限取消 Pipeline Run')
    }

    const [updated] = await this.db
      .update(schema.pipelineRuns)
      .set({
        status: 'cancelled',
        finishedAt: new Date(),
      })
      .where(eq(schema.pipelineRuns.id, runId))
      .returning()

    return updated
  }

  // 列出 Pipeline 的运行记录
  async listRuns(userId: string, pipelineId: string) {
    const pipeline = await this.get(userId, pipelineId)
    if (!pipeline) {
      throw new Error('Pipeline 不存在')
    }

    const runs = await this.db
      .select()
      .from(schema.pipelineRuns)
      .where(eq(schema.pipelineRuns.pipelineId, pipelineId))
      .orderBy(desc(schema.pipelineRuns.createdAt))
      .limit(50)

    return runs
  }

  // 获取 Run 详情
  async getRun(userId: string, runId: string) {
    const [run] = await this.db
      .select()
      .from(schema.pipelineRuns)
      .where(eq(schema.pipelineRuns.id, runId))
      .limit(1)

    if (!run) {
      return null
    }

    const [pipeline] = await this.db
      .select()
      .from(schema.pipelines)
      .where(eq(schema.pipelines.id, run.pipelineId))
      .limit(1)

    if (!pipeline) {
      throw new Error('Pipeline 不存在')
    }

    const hasAccess = await this.checkProjectAccess(userId, pipeline.projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该 Run')
    }

    return run
  }

  // 获取 Run 日志（简化实现）
  async getLogs(userId: string, runId: string) {
    const run = await this.getRun(userId, runId)
    if (!run) {
      throw new Error('Run 不存在')
    }

    // 简化实现：返回模拟日志
    return {
      runId,
      logs: run.logsUrl || 'No logs available',
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

  // 辅助方法：检查项目权限
  private async checkProjectPermission(userId: string, projectId: string): Promise<boolean> {
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
