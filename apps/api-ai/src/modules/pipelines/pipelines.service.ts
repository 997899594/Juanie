import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, like, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { 
  pipelines, 
  type Pipeline, 
  type NewPipeline, 
  type UpdatePipeline,
  insertPipelineSchema,
  updatePipelineSchema
} from '../../database/schemas';

@Injectable()
export class PipelinesService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 创建流水线
   */
  async createPipeline(data: NewPipeline): Promise<Pipeline> {
    // 验证输入数据
    const validatedData = insertPipelineSchema.parse(data);

    // 检查项目下是否已存在同名流水线
    const existingPipeline = await this.db.database
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

    const [pipeline] = await this.db.database
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
  async getPipelineById(id: string): Promise<Pipeline> {
    const [pipeline] = await this.db.database
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id))
      .limit(1);

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return pipeline;
  }

  /**
   * 获取项目的流水线列表
   */
  async getPipelinesByProject(
    projectId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      configSource?: string;
    } = {}
  ): Promise<{
    pipelines: Pipeline[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, isActive, configSource } = options;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [eq(pipelines.projectId, projectId)];

    if (search) {
      conditions.push(
        like(pipelines.name, `%${search}%`)
      );
    }

    if (isActive !== undefined) {
      conditions.push(eq(pipelines.isActive, isActive));
    }

    if (configSource) {
      conditions.push(eq(pipelines.configSource, configSource as any));
    }

    // 获取总数
    const [{ count: total }] = await this.db.database
      .select({ count: count() })
      .from(pipelines)
      .where(and(...conditions));

    // 获取分页数据
    const pipelinesList = await this.db.database
      .select()
      .from(pipelines)
      .where(and(...conditions))
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
    await this.getPipelineById(id);

    // 如果更新名称，检查是否与同项目下其他流水线重名
    if (validatedData.name) {
      const existingPipeline = await this.db.database
        .select()
        .from(pipelines)
        .where(
          and(
            eq(pipelines.projectId, validatedData.projectId || ''),
            eq(pipelines.name, validatedData.name),
            sql`${pipelines.id} != ${id}`
          )
        )
        .limit(1);

      if (existingPipeline.length > 0) {
        throw new BadRequestException('Pipeline with this name already exists in the project');
      }
    }

    const [updatedPipeline] = await this.db.database
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
    // 检查流水线是否存在
    await this.getPipelineById(id);

    await this.db.database
      .delete(pipelines)
      .where(eq(pipelines.id, id));
  }

  /**
   * 启用/禁用流水线
   */
  async togglePipelineStatus(id: string, isActive: boolean): Promise<Pipeline> {
    const [updatedPipeline] = await this.db.database
      .update(pipelines)
      .set({
        isActive,
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
  async getPipelineStats(projectId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byConfigSource: Record<string, number>;
    avgSuccessRate: number;
    avgDuration: number;
  }> {
    // 基础统计
    const [totalStats] = await this.db.database
      .select({
        total: count(),
        active: sql<number>`count(case when ${pipelines.isActive} = true then 1 end)`,
        inactive: sql<number>`count(case when ${pipelines.isActive} = false then 1 end)`,
        avgSuccessRate: sql<number>`avg(${pipelines.successRate})`,
        avgDuration: sql<number>`avg(${pipelines.averageDuration})`,
      })
      .from(pipelines)
      .where(eq(pipelines.projectId, projectId));

    // 按配置源统计
    const configSourceStats = await this.db.database
      .select({
        configSource: pipelines.configSource,
        count: count(),
      })
      .from(pipelines)
      .where(eq(pipelines.projectId, projectId))
      .groupBy(pipelines.configSource);

    const byConfigSource = configSourceStats.reduce((acc, stat) => {
      acc[stat.configSource] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: totalStats.total,
      active: totalStats.active,
      inactive: totalStats.inactive,
      byConfigSource,
      avgSuccessRate: Number(totalStats.avgSuccessRate) || 0,
      avgDuration: Number(totalStats.avgDuration) || 0,
    };
  }

  /**
   * 批量更新流水线状态
   */
  async batchUpdatePipelineStatus(
    pipelineIds: string[],
    isActive: boolean
  ): Promise<Pipeline[]> {
    const updatedPipelines = await this.db.database
      .update(pipelines)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(inArray(pipelines.id, pipelineIds))
      .returning();

    return updatedPipelines;
  }

  /**
   * 复制流水线
   */
  async clonePipeline(
    id: string,
    newName: string,
    targetProjectId?: string
  ): Promise<Pipeline> {
    const originalPipeline = await this.getPipelineById(id);

    // 检查目标项目下是否已存在同名流水线
    const projectId = targetProjectId || originalPipeline.projectId;
    const existingPipeline = await this.db.database
      .select()
      .from(pipelines)
      .where(
        and(
          eq(pipelines.projectId, projectId),
          eq(pipelines.name, newName)
        )
      )
      .limit(1);

    if (existingPipeline.length > 0) {
      throw new BadRequestException('Pipeline with this name already exists in the target project');
    }

    // 创建新流水线
    const { id: _, createdAt, updatedAt, ...pipelineData } = originalPipeline;
    
    const [clonedPipeline] = await this.db.database
      .insert(pipelines)
      .values({
        ...pipelineData,
        name: newName,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return clonedPipeline;
  }

  /**
   * 更新流水线统计数据
   */
  async updatePipelineMetrics(
    id: string,
    metrics: {
      successRate?: number;
      averageDuration?: number;
    }
  ): Promise<Pipeline> {
    const [updatedPipeline] = await this.db.database
      .update(pipelines)
      .set({
        ...metrics,
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
   * 获取流水线配置模板
   */
  async getPipelineTemplate(configSource: string): Promise<{
    template: string;
    description: string;
  }> {
    const templates = {
      repository: {
        template: `name: CI/CD Pipeline
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
    - name: Build
      run: npm run build`,
        description: 'GitHub Actions workflow template for Node.js projects',
      },
      ui: {
        template: JSON.stringify({
          stages: [
            { name: 'build', steps: ['install', 'test', 'build'] },
            { name: 'deploy', steps: ['deploy-staging', 'deploy-production'] }
          ]
        }, null, 2),
        description: 'UI-based pipeline configuration template',
      },
      api: {
        template: JSON.stringify({
          pipeline: {
            triggers: ['push', 'pull_request'],
            stages: ['build', 'test', 'deploy'],
            environment: 'nodejs'
          }
        }, null, 2),
        description: 'API-based pipeline configuration template',
      },
      template: {
        template: 'Basic template configuration',
        description: 'Template-based pipeline configuration',
      },
    };

    return templates[configSource as keyof typeof templates] || templates.repository;
  }
}