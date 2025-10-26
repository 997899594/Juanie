import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, like, inArray, gte, lte, between } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { 
  pipelineRuns, 
  pipelines,
  users,
  type PipelineRun, 
  type NewPipelineRun, 
  type UpdatePipelineRun,
  insertPipelineRunSchema,
  updatePipelineRunSchema
} from '../../database/schemas';

@Injectable()
export class PipelineRunsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 创建流水线执行
   */
  async createPipelineRun(data: NewPipelineRun): Promise<PipelineRun> {
    // 验证输入数据
    const validatedData = insertPipelineRunSchema.parse(data);

    // 检查流水线是否存在
    const [pipeline] = await this.db.database
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, validatedData.pipelineId))
      .limit(1);

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    // 生成运行序号
    const [lastRun] = await this.db.database
      .select({ runNumber: pipelineRuns.runNumber })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.pipelineId, validatedData.pipelineId))
      .orderBy(desc(pipelineRuns.runNumber))
      .limit(1);

    const runNumber = (lastRun?.runNumber || 0) + 1;

    const [pipelineRun] = await this.db.database
      .insert(pipelineRuns)
      .values({
        ...validatedData,
        runNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return pipelineRun;
  }

  /**
   * 根据ID获取流水线执行
   */
  async getPipelineRunById(id: string): Promise<PipelineRun & {
    pipeline?: { name: string; projectId: string };
    triggeredByUser?: { name: string; email: string };
  }> {
    const [pipelineRun] = await this.db.database
      .select({
        ...pipelineRuns,
        pipeline: {
          name: pipelines.name,
          projectId: pipelines.projectId,
        },
        triggeredByUser: {
          name: users.name,
          email: users.email,
        },
      })
      .from(pipelineRuns)
      .leftJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
      .leftJoin(users, eq(pipelineRuns.triggeredBy, users.id))
      .where(eq(pipelineRuns.id, id))
      .limit(1);

    if (!pipelineRun) {
      throw new NotFoundException('Pipeline run not found');
    }

    return pipelineRun;
  }

  /**
   * 获取流水线的执行列表
   */
  async getPipelineRunsByPipeline(
    pipelineId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      branch?: string;
      triggeredBy?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    runs: (PipelineRun & {
      pipeline?: { name: string };
      triggeredByUser?: { name: string; email: string };
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, status, branch, triggeredBy, dateFrom, dateTo } = options;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [eq(pipelineRuns.pipelineId, pipelineId)];

    if (status) {
      conditions.push(eq(pipelineRuns.status, status as any));
    }

    if (branch) {
      conditions.push(eq(pipelineRuns.branch, branch));
    }

    if (triggeredBy) {
      conditions.push(eq(pipelineRuns.triggeredBy, triggeredBy));
    }

    if (dateFrom && dateTo) {
      conditions.push(between(pipelineRuns.createdAt, dateFrom, dateTo));
    } else if (dateFrom) {
      conditions.push(gte(pipelineRuns.createdAt, dateFrom));
    } else if (dateTo) {
      conditions.push(lte(pipelineRuns.createdAt, dateTo));
    }

    // 获取总数
    const [{ count: total }] = await this.db.database
      .select({ count: count() })
      .from(pipelineRuns)
      .where(and(...conditions));

    // 获取分页数据
    const runs = await this.db.database
      .select({
        ...pipelineRuns,
        pipeline: {
          name: pipelines.name,
        },
        triggeredByUser: {
          name: users.name,
          email: users.email,
        },
      })
      .from(pipelineRuns)
      .leftJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
      .leftJoin(users, eq(pipelineRuns.triggeredBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(pipelineRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      runs,
      total,
      page,
      limit,
    };
  }

  /**
   * 获取项目的流水线执行列表
   */
  async getPipelineRunsByProject(
    projectId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      pipelineId?: string;
    } = {}
  ): Promise<{
    runs: (PipelineRun & {
      pipeline?: { name: string };
      triggeredByUser?: { name: string; email: string };
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, status, pipelineId } = options;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [eq(pipelines.projectId, projectId)];

    if (status) {
      conditions.push(eq(pipelineRuns.status, status as any));
    }

    if (pipelineId) {
      conditions.push(eq(pipelineRuns.pipelineId, pipelineId));
    }

    // 获取总数
    const [{ count: total }] = await this.db.database
      .select({ count: count() })
      .from(pipelineRuns)
      .innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
      .where(and(...conditions));

    // 获取分页数据
    const runs = await this.db.database
      .select({
        ...pipelineRuns,
        pipeline: {
          name: pipelines.name,
        },
        triggeredByUser: {
          name: users.name,
          email: users.email,
        },
      })
      .from(pipelineRuns)
      .innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
      .leftJoin(users, eq(pipelineRuns.triggeredBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(pipelineRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      runs,
      total,
      page,
      limit,
    };
  }

  /**
   * 更新流水线执行
   */
  async updatePipelineRun(id: string, data: UpdatePipelineRun): Promise<PipelineRun> {
    // 验证输入数据
    const validatedData = updatePipelineRunSchema.parse(data);

    // 检查流水线执行是否存在
    await this.getPipelineRunById(id);

    const [updatedPipelineRun] = await this.db.database
      .update(pipelineRuns)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, id))
      .returning();

    return updatedPipelineRun;
  }

  /**
   * 开始执行流水线
   */
  async startPipelineRun(id: string): Promise<PipelineRun> {
    const [updatedPipelineRun] = await this.db.database
      .update(pipelineRuns)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, id))
      .returning();

    if (!updatedPipelineRun) {
      throw new NotFoundException('Pipeline run not found');
    }

    return updatedPipelineRun;
  }

  /**
   * 完成流水线执行
   */
  async finishPipelineRun(
    id: string,
    status: 'success' | 'failure' | 'cancelled',
    duration?: number
  ): Promise<PipelineRun> {
    const finishedAt = new Date();
    
    const [updatedPipelineRun] = await this.db.database
      .update(pipelineRuns)
      .set({
        status,
        finishedAt,
        duration,
        updatedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, id))
      .returning();

    if (!updatedPipelineRun) {
      throw new NotFoundException('Pipeline run not found');
    }

    return updatedPipelineRun;
  }

  /**
   * 取消流水线执行
   */
  async cancelPipelineRun(id: string): Promise<PipelineRun> {
    return this.finishPipelineRun(id, 'cancelled');
  }

  /**
   * 重新运行流水线
   */
  async retryPipelineRun(id: string, triggeredBy?: string): Promise<PipelineRun> {
    const originalRun = await this.getPipelineRunById(id);

    // 创建新的执行记录
    const { id: _, runNumber, createdAt, updatedAt, startedAt, finishedAt, duration, ...runData } = originalRun;
    
    const newRun = await this.createPipelineRun({
      ...runData,
      triggeredBy: triggeredBy || runData.triggeredBy,
      status: 'pending',
    });

    return newRun;
  }

  /**
   * 获取流水线执行统计
   */
  async getPipelineRunStats(
    pipelineId?: string,
    projectId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    total: number;
    success: number;
    failure: number;
    cancelled: number;
    running: number;
    pending: number;
    successRate: number;
    avgDuration: number;
    totalDuration: number;
    byStatus: Record<string, number>;
    byBranch: Record<string, number>;
  }> {
    // 构建查询条件
    const conditions = [];

    if (pipelineId) {
      conditions.push(eq(pipelineRuns.pipelineId, pipelineId));
    }

    if (projectId) {
      conditions.push(eq(pipelines.projectId, projectId));
    }

    if (dateFrom && dateTo) {
      conditions.push(between(pipelineRuns.createdAt, dateFrom, dateTo));
    } else if (dateFrom) {
      conditions.push(gte(pipelineRuns.createdAt, dateFrom));
    } else if (dateTo) {
      conditions.push(lte(pipelineRuns.createdAt, dateTo));
    }

    // 基础统计
    const query = this.db.database
      .select({
        total: count(),
        success: sql<number>`count(case when ${pipelineRuns.status} = 'success' then 1 end)`,
        failure: sql<number>`count(case when ${pipelineRuns.status} = 'failure' then 1 end)`,
        cancelled: sql<number>`count(case when ${pipelineRuns.status} = 'cancelled' then 1 end)`,
        running: sql<number>`count(case when ${pipelineRuns.status} = 'running' then 1 end)`,
        pending: sql<number>`count(case when ${pipelineRuns.status} = 'pending' then 1 end)`,
        avgDuration: sql<number>`avg(${pipelineRuns.duration})`,
        totalDuration: sql<number>`sum(${pipelineRuns.duration})`,
      })
      .from(pipelineRuns);

    if (projectId && !pipelineId) {
      query.innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const [stats] = await query;

    // 按状态统计
    const statusQuery = this.db.database
      .select({
        status: pipelineRuns.status,
        count: count(),
      })
      .from(pipelineRuns);

    if (projectId && !pipelineId) {
      statusQuery.innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id));
    }

    if (conditions.length > 0) {
      statusQuery.where(and(...conditions));
    }

    const statusStats = await statusQuery.groupBy(pipelineRuns.status);

    // 按分支统计
    const branchQuery = this.db.database
      .select({
        branch: pipelineRuns.branch,
        count: count(),
      })
      .from(pipelineRuns);

    if (projectId && !pipelineId) {
      branchQuery.innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id));
    }

    if (conditions.length > 0) {
      branchQuery.where(and(...conditions));
    }

    const branchStats = await branchQuery
      .where(sql`${pipelineRuns.branch} IS NOT NULL`)
      .groupBy(pipelineRuns.branch);

    const byStatus = statusStats.reduce((acc, stat) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    const byBranch = branchStats.reduce((acc, stat) => {
      if (stat.branch) {
        acc[stat.branch] = stat.count;
      }
      return acc;
    }, {} as Record<string, number>);

    const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;

    return {
      total: stats.total,
      success: stats.success,
      failure: stats.failure,
      cancelled: stats.cancelled,
      running: stats.running,
      pending: stats.pending,
      successRate: Number(successRate.toFixed(2)),
      avgDuration: Number(stats.avgDuration) || 0,
      totalDuration: Number(stats.totalDuration) || 0,
      byStatus,
      byBranch,
    };
  }

  /**
   * 批量取消流水线执行
   */
  async batchCancelPipelineRuns(runIds: string[]): Promise<PipelineRun[]> {
    const updatedRuns = await this.db.database
      .update(pipelineRuns)
      .set({
        status: 'cancelled',
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(pipelineRuns.id, runIds),
          inArray(pipelineRuns.status, ['pending', 'running'])
        )
      )
      .returning();

    return updatedRuns;
  }

  /**
   * 删除流水线执行记录
   */
  async deletePipelineRun(id: string): Promise<void> {
    // 检查流水线执行是否存在
    await this.getPipelineRunById(id);

    await this.db.database
      .delete(pipelineRuns)
      .where(eq(pipelineRuns.id, id));
  }

  /**
   * 批量删除流水线执行记录
   */
  async batchDeletePipelineRuns(runIds: string[]): Promise<void> {
    await this.db.database
      .delete(pipelineRuns)
      .where(inArray(pipelineRuns.id, runIds));
  }

  /**
   * 获取最近的流水线执行
   */
  async getRecentPipelineRuns(
    projectId: string,
    limit: number = 10
  ): Promise<(PipelineRun & {
    pipeline?: { name: string };
    triggeredByUser?: { name: string; email: string };
  })[]> {
    const runs = await this.db.database
      .select({
        ...pipelineRuns,
        pipeline: {
          name: pipelines.name,
        },
        triggeredByUser: {
          name: users.name,
          email: users.email,
        },
      })
      .from(pipelineRuns)
      .innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
      .leftJoin(users, eq(pipelineRuns.triggeredBy, users.id))
      .where(eq(pipelines.projectId, projectId))
      .orderBy(desc(pipelineRuns.createdAt))
      .limit(limit);

    return runs;
  }
}