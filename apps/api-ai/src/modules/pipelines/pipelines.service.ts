import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, like, inArray } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { 
  pipelines, 
  pipelineRuns,
  type Pipeline, 
  type NewPipeline, 
  type UpdatePipeline,
  type ConfigSource,
  insertPipelineSchema,
  updatePipelineSchema
} from '../../database/schemas';

@Injectable()
export class PipelinesService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建流水线
   */
  async createPipeline(data: NewPipeline): Promise<Pipeline> {
    // 验证输入数据
    const validatedData = insertPipelineSchema.parse(data);

    // 检查项目下是否已存在同名流水线
    const existingPipeline = await this.db
      .select()
      .from(pipelines)
      .where(
        and(
          eq(pipelines.projectId, validatedData.projectId),
          eq(pipelines.name, validatedData.name)
        )
      )
      .limit(1);

    if (existingPipeline.length > 0) {
      throw new BadRequestException('Pipeline with this name already exists in the project');
    }

    const [pipeline] = await this.db
      .insert(pipelines)
      .values({
        ...validatedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return pipeline;
  }

  /**
   * 根据ID获取流水线
   */
  async getPipelineById(id: string): Promise<Pipeline | null> {
    const [pipeline] = await this.db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id))
      .limit(1);

    return pipeline || null;
  }

  /**
   * 根据项目ID获取流水线列表
   */
  async getPipelinesByProject(
    projectId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      configSource?: ConfigSource;
    } = {}
  ): Promise<{
    pipelines: Pipeline[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, isActive, configSource } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(pipelines.projectId, projectId)];

    if (search) {
      conditions.push(like(pipelines.name, `%${search}%`));
    }

    if (isActive !== undefined) {
      conditions.push(eq(pipelines.isActive, isActive));
    }

    if (configSource) {
      conditions.push(eq(pipelines.configSource, configSource));
    }

    const whereClause = and(...conditions);

    // 获取总数
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(pipelines)
      .where(whereClause);

    // 获取分页数据
    const pipelinesList = await this.db
      .select()
      .from(pipelines)
      .where(whereClause)
      .orderBy(desc(pipelines.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      pipelines: pipelinesList,
      total,
      page,
      limit,
    };
  }

  /**
   * 更新流水线
   */
  async updatePipeline(id: string, data: UpdatePipeline): Promise<Pipeline> {
    // 验证输入数据
    const validatedData = updatePipelineSchema.parse(data);

    // 检查流水线是否存在
    const existingPipeline = await this.db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id))
      .limit(1);

    if (existingPipeline.length === 0) {
      throw new NotFoundException('Pipeline not found');
    }

    // 如果更新名称，检查是否与同项目下其他流水线重名
    if (validatedData.name && validatedData.name !== existingPipeline[0].name) {
      const duplicatePipeline = await this.db
        .select()
        .from(pipelines)
        .where(
          and(
            eq(pipelines.projectId, existingPipeline[0].projectId),
            eq(pipelines.name, validatedData.name),
            sql`${pipelines.id} != ${id}`
          )
        )
        .limit(1);

      if (duplicatePipeline.length > 0) {
        throw new BadRequestException('Pipeline with this name already exists in the project');
      }
    }

    const [updatedPipeline] = await this.db
      .update(pipelines)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(pipelines.id, id))
      .returning();

    return updatedPipeline;
  }

  /**
   * 删除流水线
   */
  async deletePipeline(id: string): Promise<void> {
    const result = await this.db
      .delete(pipelines)
      .where(eq(pipelines.id, id));

    // 检查是否有行被删除 - 对于 delete 操作，我们无法直接检查影响的行数
    // 可以先查询确认记录存在
    const existingPipeline = await this.db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id))
      .limit(1);

    if (existingPipeline.length === 0) {
      throw new NotFoundException('Pipeline not found');
    }
  }

  /**
   * 切换流水线状态
   */
  async togglePipelineStatus(id: string): Promise<Pipeline> {
    const [updatedPipeline] = await this.db
      .update(pipelines)
      .set({
        isActive: sql`NOT ${pipelines.isActive}`,
        updatedAt: new Date(),
      })
      .where(eq(pipelines.id, id))
      .returning();

    if (!updatedPipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return updatedPipeline;
  }

  /**
   * 获取流水线统计信息
   */
  async getPipelineStats(projectId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byConfigSource: Record<string, number>;
    avgSuccessRate: number;
    avgDuration: number;
  }> {
    const conditions = projectId ? [eq(pipelines.projectId, projectId)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总体统计
    const [totalStats] = await this.db
      .select({
        total: count(),
        active: count(sql`CASE WHEN ${pipelines.isActive} = true THEN 1 END`),
        inactive: count(sql`CASE WHEN ${pipelines.isActive} = false THEN 1 END`),
      })
      .from(pipelines)
      .where(whereClause);

    // 获取按配置源分组的统计
    const configSourceStats = await this.db
      .select({
        configSource: pipelines.configSource,
        count: count(),
      })
      .from(pipelines)
      .where(whereClause)
      .groupBy(pipelines.configSource);

    const byConfigSource = configSourceStats.reduce((acc: any, stat: any) => {
      acc[stat.configSource || 'unknown'] = stat.count;
      return acc;
    }, {});

    // 获取流水线运行统计（成功率和平均持续时间）
    const runStatsQuery = this.db
      .select({
        totalRuns: count(),
        successRuns: sql<number>`count(case when ${pipelineRuns.status} = 'success' then 1 end)`,
        avgDuration: sql<number>`avg(${pipelineRuns.duration})`,
      })
      .from(pipelines)
      .leftJoin(pipelineRuns, eq(pipelineRuns.pipelineId, pipelines.id))
      .where(whereClause);

    const [runStats] = await runStatsQuery;

    const avgSuccessRate = runStats.totalRuns > 0 
      ? Number(((runStats.successRuns / runStats.totalRuns) * 100).toFixed(2))
      : 0;
    
    const avgDuration = Number(runStats.avgDuration) || 0;

    return {
      total: totalStats.total,
      active: totalStats.active,
      inactive: totalStats.inactive,
      byConfigSource,
      avgSuccessRate,
      avgDuration,
    };
  }

  /**
   * 批量更新流水线状态
   */
  async batchUpdatePipelineStatus(ids: string[], isActive: boolean): Promise<Pipeline[]> {
    const updatedPipelines = await this.db
      .update(pipelines)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(inArray(pipelines.id, ids))
      .returning();

    return updatedPipelines;
  }

  /**
   * 克隆流水线
   */
  async clonePipeline(id: string, newName: string, projectId?: string): Promise<Pipeline> {
    // 获取原流水线
    const [originalPipeline] = await this.db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id))
      .limit(1);

    if (!originalPipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    const targetProjectId = projectId || originalPipeline.projectId;

    // 检查新名称是否已存在
    const existingPipeline = await this.db
      .select()
      .from(pipelines)
      .where(
        and(
          eq(pipelines.projectId, targetProjectId),
          eq(pipelines.name, newName)
        )
      )
      .limit(1);

    if (existingPipeline.length > 0) {
      throw new BadRequestException('Pipeline with this name already exists in the target project');
    }

    // 创建克隆的流水线
    const [clonedPipeline] = await this.db
      .insert(pipelines)
      .values({
        name: newName,
        description: originalPipeline.description,
        projectId: targetProjectId,
        configSource: originalPipeline.configSource,
        isActive: false, // 克隆的流水线默认为非激活状态
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return clonedPipeline;
  }

  /**
   * 更新流水线配置
   */
  async updatePipelineConfig(id: string, configData: any): Promise<Pipeline> {
    const [updatedPipeline] = await this.db
      .update(pipelines)
      .set({
        // 移除 config 属性，因为它不存在于 schema 中
        updatedAt: new Date(),
      })
      .where(eq(pipelines.id, id))
      .returning();

    if (!updatedPipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return updatedPipeline;
  }
}