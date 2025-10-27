import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, like, inArray, gte, lte, between, or } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { 
  pipelineRuns, 
  pipelines,
  users,
  type PipelineRun, 
  type NewPipelineRun, 
  type UpdatePipelineRun,
  insertPipelineRunSchema,
  updatePipelineRunSchema,
  selectPipelineRunSchema,
  PipelineRunStatusEnum,
  PipelineRunTriggerTypeEnum,
  type PipelineRunStatus,
  type PipelineRunTriggerType
} from '../../database/schemas';
import { z } from 'zod';

// 查询参数验证schemas
const getPipelineRunsByPipelineInputSchema = z.object({
  pipelineId: z.string().uuid(),
  limit: z.number().int().positive().max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
});

const getPipelineRunsByProjectInputSchema = z.object({
  projectId: z.string().uuid(),
  limit: z.number().int().positive().max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
});

// 扩展的返回类型schema
const pipelineRunWithDetailsSchema = selectPipelineRunSchema.extend({
  pipeline: z.object({
    name: z.string(),
    projectId: z.string().uuid().optional(),
  }).optional(),
  triggerUser: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
});

type PipelineRunWithDetails = z.infer<typeof pipelineRunWithDetailsSchema>;

@Injectable()
export class PipelineRunsService {
  private readonly logger = new Logger(PipelineRunsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 通用的数据库查询字段选择器
   */
  private readonly selectFields = {
    id: pipelineRuns.id,
    pipelineId: pipelineRuns.pipelineId,
    triggerType: pipelineRuns.triggerType,
    triggerUserId: pipelineRuns.triggerUserId,
    triggerSource: pipelineRuns.triggerSource,
    triggerBranch: pipelineRuns.triggerBranch,
    triggerCommit: pipelineRuns.triggerCommit,
    runNumber: pipelineRuns.runNumber,
    commitHash: pipelineRuns.commitHash,
    branch: pipelineRuns.branch,
    status: pipelineRuns.status,
    startedAt: pipelineRuns.startedAt,
    finishedAt: pipelineRuns.finishedAt,
    duration: pipelineRuns.duration,
    computeUnitsUsed: pipelineRuns.computeUnitsUsed,
    estimatedCost: pipelineRuns.estimatedCost,
    carbonFootprint: pipelineRuns.carbonFootprint,
    failurePredictionScore: pipelineRuns.failurePredictionScore,
    optimizationSuggestion: pipelineRuns.optimizationSuggestion,
    performanceScore: pipelineRuns.performanceScore,
    testsTotal: pipelineRuns.testsTotal,
    testsPassed: pipelineRuns.testsPassed,
    testsFailed: pipelineRuns.testsFailed,
    testCoverage: pipelineRuns.testCoverage,
    vulnerabilitiesCritical: pipelineRuns.vulnerabilitiesCritical,
    vulnerabilitiesHigh: pipelineRuns.vulnerabilitiesHigh,
    vulnerabilitiesMedium: pipelineRuns.vulnerabilitiesMedium,
    vulnerabilitiesLow: pipelineRuns.vulnerabilitiesLow,
    securityScore: pipelineRuns.securityScore,
    artifactCount: pipelineRuns.artifactCount,
    artifactSizeMb: pipelineRuns.artifactSizeMb,
    createdAt: pipelineRuns.createdAt,
    updatedAt: pipelineRuns.updatedAt,
    // Related data
    pipelineName: pipelines.name,
    pipelineProjectId: pipelines.projectId,
    triggerUserName: users.displayName,
    triggerUserEmail: users.email,
  };

  /**
   * 通用的数据映射函数，将查询结果转换为标准格式并验证
   */
  private mapPipelineRunWithDetails(run: any): PipelineRunWithDetails {
    try {
      const mappedRun = {
        id: run.id,
        pipelineId: run.pipelineId,
        triggerType: run.triggerType,
        triggerUserId: run.triggerUserId,
        triggerSource: run.triggerSource,
        triggerBranch: run.triggerBranch,
        triggerCommit: run.triggerCommit,
        runNumber: run.runNumber,
        commitHash: run.commitHash,
        branch: run.branch,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        duration: run.duration,
        computeUnitsUsed: run.computeUnitsUsed,
        estimatedCost: run.estimatedCost,
        carbonFootprint: run.carbonFootprint,
        failurePredictionScore: run.failurePredictionScore,
        optimizationSuggestion: run.optimizationSuggestion,
        performanceScore: run.performanceScore,
        testsTotal: run.testsTotal,
        testsPassed: run.testsPassed,
        testsFailed: run.testsFailed,
        testCoverage: run.testCoverage,
        vulnerabilitiesCritical: run.vulnerabilitiesCritical,
        vulnerabilitiesHigh: run.vulnerabilitiesHigh,
        vulnerabilitiesMedium: run.vulnerabilitiesMedium,
        vulnerabilitiesLow: run.vulnerabilitiesLow,
        securityScore: run.securityScore,
        artifactCount: run.artifactCount,
        artifactSizeMb: run.artifactSizeMb,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        pipeline: run.pipelineName ? {
          name: run.pipelineName,
          projectId: run.pipelineProjectId
        } : undefined,
        triggerUser: run.triggerUserName && run.triggerUserEmail ? {
          name: run.triggerUserName,
          email: run.triggerUserEmail
        } : undefined,
      };

      // 使用schema验证输出
      return pipelineRunWithDetailsSchema.parse(mappedRun);
    } catch (error) {
      this.logger.error(`Failed to map pipeline run data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Invalid pipeline run data format');
    }
  }

  /**
   * 创建新的流水线运行
   */
  async createPipelineRun(data: NewPipelineRun): Promise<PipelineRun> {
    try {
      const validatedData = insertPipelineRunSchema.parse(data);
      
      const [newRun] = await this.db
        .insert(pipelineRuns)
        .values(validatedData)
        .returning();

      this.logger.log(`Pipeline run created: ${newRun.id}`);
      return newRun;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create pipeline run: ${errorMessage}`);
      throw new BadRequestException('Failed to create pipeline run');
    }
  }

  /**
   * 根据ID获取流水线运行详情
   */
  async getPipelineRunById(id: string): Promise<PipelineRunWithDetails> {
    try {
      const result = await this.db
        .select(this.selectFields)
        .from(pipelineRuns)
        .leftJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
        .leftJoin(users, eq(pipelineRuns.triggerUserId, users.id))
        .where(eq(pipelineRuns.id, id))
        .limit(1);

      if (!result.length) {
        throw new NotFoundException(`Pipeline run with ID ${id} not found`);
      }

      return this.mapPipelineRunWithDetails(result[0]);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get pipeline run by ID ${id}: ${errorMessage}`);
      throw new BadRequestException('Failed to get pipeline run');
    }
  }

  /**
   * 根据流水线ID获取运行列表
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
      triggerUser?: { name: string; email: string };
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 20, status, branch, triggeredBy, dateFrom, dateTo } = options;
      const offset = (page - 1) * limit;

      const whereConditions = [eq(pipelineRuns.pipelineId, pipelineId)];

      if (status) {
        whereConditions.push(eq(pipelineRuns.status, status as any));
      }
      if (branch) {
        whereConditions.push(eq(pipelineRuns.branch, branch));
      }
      if (triggeredBy) {
        whereConditions.push(eq(pipelineRuns.triggerUserId, triggeredBy));
      }
      if (dateFrom) {
        whereConditions.push(gte(pipelineRuns.createdAt, dateFrom));
      }
      if (dateTo) {
        whereConditions.push(lte(pipelineRuns.createdAt, dateTo));
      }

      const whereClause = and(...whereConditions);

      // Get total count
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(pipelineRuns)
        .where(whereClause);

      // Get runs with related data
      const results = await this.db
        .select({
          // Pipeline run fields
          id: pipelineRuns.id,
          pipelineId: pipelineRuns.pipelineId,
          triggerType: pipelineRuns.triggerType,
          triggerUserId: pipelineRuns.triggerUserId,
          triggerSource: pipelineRuns.triggerSource,
          triggerBranch: pipelineRuns.triggerBranch,
          triggerCommit: pipelineRuns.triggerCommit,
          runNumber: pipelineRuns.runNumber,
          commitHash: pipelineRuns.commitHash,
          branch: pipelineRuns.branch,
          status: pipelineRuns.status,
          startedAt: pipelineRuns.startedAt,
          finishedAt: pipelineRuns.finishedAt,
          duration: pipelineRuns.duration,
          computeUnitsUsed: pipelineRuns.computeUnitsUsed,
          estimatedCost: pipelineRuns.estimatedCost,
          carbonFootprint: pipelineRuns.carbonFootprint,
          failurePredictionScore: pipelineRuns.failurePredictionScore,
          optimizationSuggestion: pipelineRuns.optimizationSuggestion,
          performanceScore: pipelineRuns.performanceScore,
          testsTotal: pipelineRuns.testsTotal,
          testsPassed: pipelineRuns.testsPassed,
          testsFailed: pipelineRuns.testsFailed,
          testCoverage: pipelineRuns.testCoverage,
          vulnerabilitiesCritical: pipelineRuns.vulnerabilitiesCritical,
          vulnerabilitiesHigh: pipelineRuns.vulnerabilitiesHigh,
          vulnerabilitiesMedium: pipelineRuns.vulnerabilitiesMedium,
          vulnerabilitiesLow: pipelineRuns.vulnerabilitiesLow,
          securityScore: pipelineRuns.securityScore,
          artifactCount: pipelineRuns.artifactCount,
          artifactSizeMb: pipelineRuns.artifactSizeMb,
          createdAt: pipelineRuns.createdAt,
          updatedAt: pipelineRuns.updatedAt,
          // Related data
          pipelineName: pipelines.name,
          triggerUserName: users.displayName,
          triggerUserEmail: users.email,
        })
        .from(pipelineRuns)
        .leftJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
        .leftJoin(users, eq(pipelineRuns.triggerUserId, users.id))
        .where(whereClause)
        .orderBy(desc(pipelineRuns.createdAt))
        .limit(limit)
        .offset(offset);

      const runs = results.map(run => ({
        id: run.id,
        pipelineId: run.pipelineId,
        triggerType: run.triggerType,
        triggerUserId: run.triggerUserId,
        triggerSource: run.triggerSource,
        triggerBranch: run.triggerBranch,
        triggerCommit: run.triggerCommit,
        runNumber: run.runNumber,
        commitHash: run.commitHash,
        branch: run.branch,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        duration: run.duration,
        computeUnitsUsed: run.computeUnitsUsed,
        estimatedCost: run.estimatedCost,
        carbonFootprint: run.carbonFootprint,
        failurePredictionScore: run.failurePredictionScore,
        optimizationSuggestion: run.optimizationSuggestion,
        performanceScore: run.performanceScore,
        testsTotal: run.testsTotal,
        testsPassed: run.testsPassed,
        testsFailed: run.testsFailed,
        testCoverage: run.testCoverage,
        vulnerabilitiesCritical: run.vulnerabilitiesCritical,
        vulnerabilitiesHigh: run.vulnerabilitiesHigh,
        vulnerabilitiesMedium: run.vulnerabilitiesMedium,
        vulnerabilitiesLow: run.vulnerabilitiesLow,
        securityScore: run.securityScore,
        artifactCount: run.artifactCount,
        artifactSizeMb: run.artifactSizeMb,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        pipeline: run.pipelineName ? { name: run.pipelineName } : undefined,
        triggerUser: run.triggerUserName && run.triggerUserEmail ? {
          name: run.triggerUserName,
          email: run.triggerUserEmail
        } : undefined,
      }));

      return {
        runs,
        total: totalResult.count,
        page,
        limit,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get pipeline runs by pipeline ${pipelineId}: ${errorMessage}`);
      throw new BadRequestException('Failed to get pipeline runs');
    }
  }

  /**
   * 根据项目ID获取运行列表
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
      triggerUser?: { name: string; email: string };
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 20, status, pipelineId } = options;
      const offset = (page - 1) * limit;

      const whereConditions = [eq(pipelines.projectId, projectId)];

      if (status) {
        whereConditions.push(eq(pipelineRuns.status, status as any));
      }
      if (pipelineId) {
        whereConditions.push(eq(pipelineRuns.pipelineId, pipelineId));
      }

      const whereClause = and(...whereConditions);

      // Get total count
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(pipelineRuns)
        .innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
        .where(whereClause);

      // Get runs with related data
      const results = await this.db
        .select({
          // Pipeline run fields
          id: pipelineRuns.id,
          pipelineId: pipelineRuns.pipelineId,
          triggerType: pipelineRuns.triggerType,
          triggerUserId: pipelineRuns.triggerUserId,
          triggerSource: pipelineRuns.triggerSource,
          triggerBranch: pipelineRuns.triggerBranch,
          triggerCommit: pipelineRuns.triggerCommit,
          runNumber: pipelineRuns.runNumber,
          commitHash: pipelineRuns.commitHash,
          branch: pipelineRuns.branch,
          status: pipelineRuns.status,
          startedAt: pipelineRuns.startedAt,
          finishedAt: pipelineRuns.finishedAt,
          duration: pipelineRuns.duration,
          computeUnitsUsed: pipelineRuns.computeUnitsUsed,
          estimatedCost: pipelineRuns.estimatedCost,
          carbonFootprint: pipelineRuns.carbonFootprint,
          failurePredictionScore: pipelineRuns.failurePredictionScore,
          optimizationSuggestion: pipelineRuns.optimizationSuggestion,
          performanceScore: pipelineRuns.performanceScore,
          testsTotal: pipelineRuns.testsTotal,
          testsPassed: pipelineRuns.testsPassed,
          testsFailed: pipelineRuns.testsFailed,
          testCoverage: pipelineRuns.testCoverage,
          vulnerabilitiesCritical: pipelineRuns.vulnerabilitiesCritical,
          vulnerabilitiesHigh: pipelineRuns.vulnerabilitiesHigh,
          vulnerabilitiesMedium: pipelineRuns.vulnerabilitiesMedium,
          vulnerabilitiesLow: pipelineRuns.vulnerabilitiesLow,
          securityScore: pipelineRuns.securityScore,
          artifactCount: pipelineRuns.artifactCount,
          artifactSizeMb: pipelineRuns.artifactSizeMb,
          createdAt: pipelineRuns.createdAt,
          updatedAt: pipelineRuns.updatedAt,
          // Related data
          pipelineName: pipelines.name,
          triggerUserName: users.displayName,
          triggerUserEmail: users.email,
        })
        .from(pipelineRuns)
        .innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
        .leftJoin(users, eq(pipelineRuns.triggerUserId, users.id))
        .where(whereClause)
        .orderBy(desc(pipelineRuns.createdAt))
        .limit(limit)
        .offset(offset);

      const runs = results.map(run => ({
        id: run.id,
        pipelineId: run.pipelineId,
        triggerType: run.triggerType,
        triggerUserId: run.triggerUserId,
        triggerSource: run.triggerSource,
        triggerBranch: run.triggerBranch,
        triggerCommit: run.triggerCommit,
        runNumber: run.runNumber,
        commitHash: run.commitHash,
        branch: run.branch,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        duration: run.duration,
        computeUnitsUsed: run.computeUnitsUsed,
        estimatedCost: run.estimatedCost,
        carbonFootprint: run.carbonFootprint,
        failurePredictionScore: run.failurePredictionScore,
        optimizationSuggestion: run.optimizationSuggestion,
        performanceScore: run.performanceScore,
        testsTotal: run.testsTotal,
        testsPassed: run.testsPassed,
        testsFailed: run.testsFailed,
        testCoverage: run.testCoverage,
        vulnerabilitiesCritical: run.vulnerabilitiesCritical,
        vulnerabilitiesHigh: run.vulnerabilitiesHigh,
        vulnerabilitiesMedium: run.vulnerabilitiesMedium,
        vulnerabilitiesLow: run.vulnerabilitiesLow,
        securityScore: run.securityScore,
        artifactCount: run.artifactCount,
        artifactSizeMb: run.artifactSizeMb,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        pipeline: run.pipelineName ? { name: run.pipelineName } : undefined,
        triggerUser: run.triggerUserName && run.triggerUserEmail ? {
          name: run.triggerUserName,
          email: run.triggerUserEmail
        } : undefined,
      }));

      return {
        runs,
        total: totalResult.count,
        page,
        limit,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get pipeline runs by project ${projectId}: ${errorMessage}`);
      throw new BadRequestException('Failed to get pipeline runs');
    }
  }

  /**
   * 更新流水线运行
   */
  async updatePipelineRun(id: string, data: UpdatePipelineRun): Promise<PipelineRun> {
    try {
      const validatedData = updatePipelineRunSchema.parse(data);
      
      const [updatedRun] = await this.db
        .update(pipelineRuns)
        .set(validatedData)
        .where(eq(pipelineRuns.id, id))
        .returning();

      if (!updatedRun) {
        throw new NotFoundException(`Pipeline run with ID ${id} not found`);
      }

      this.logger.log(`Pipeline run updated: ${id}`);
      return updatedRun;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update pipeline run ${id}: ${errorMessage}`);
      throw new BadRequestException('Failed to update pipeline run');
    }
  }

  /**
   * 开始流水线运行
   */
  async startPipelineRun(id: string): Promise<PipelineRun> {
    try {
      const [updatedRun] = await this.db
        .update(pipelineRuns)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(pipelineRuns.id, id))
        .returning();

      if (!updatedRun) {
        throw new NotFoundException(`Pipeline run with ID ${id} not found`);
      }

      this.logger.log(`Pipeline run started: ${id}`);
      return updatedRun;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start pipeline run ${id}: ${errorMessage}`);
      throw new BadRequestException('Failed to start pipeline run');
    }
  }

  /**
   * 完成流水线运行
   */
  async finishPipelineRun(
    id: string,
    status: 'success' | 'failed' | 'cancelled',
    duration?: number
  ): Promise<PipelineRun> {
    try {
      const finishedAt = new Date();
      
      const [updatedRun] = await this.db
        .update(pipelineRuns)
        .set({
          status,
          finishedAt,
          duration,
        })
        .where(eq(pipelineRuns.id, id))
        .returning();

      if (!updatedRun) {
        throw new NotFoundException(`Pipeline run with ID ${id} not found`);
      }

      this.logger.log(`Pipeline run finished: ${id} with status ${status}`);
      return updatedRun;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to finish pipeline run ${id}: ${errorMessage}`);
      throw new BadRequestException('Failed to finish pipeline run');
    }
  }

  /**
   * 取消流水线运行
   */
  async cancelPipelineRun(id: string): Promise<PipelineRun> {
    return this.finishPipelineRun(id, 'cancelled');
  }

  /**
   * 重试流水线运行
   */
  async retryPipelineRun(id: string, triggeredBy?: string): Promise<PipelineRun> {
    try {
      const originalRun = await this.getPipelineRunById(id);
      
      const newRunData: NewPipelineRun = {
        pipelineId: originalRun.pipelineId,
        triggerType: 'manual',
        triggerUserId: triggeredBy || originalRun.triggerUserId,
        triggerSource: 'retry',
        triggerBranch: originalRun.triggerBranch,
        triggerCommit: originalRun.triggerCommit,
        runNumber: originalRun.runNumber + 1000, // Add offset for retry
        commitHash: originalRun.commitHash,
        branch: originalRun.branch,
      };

      const newRun = await this.createPipelineRun(newRunData);
      this.logger.log(`Pipeline run retried: ${id} -> ${newRun.id}`);
      return newRun;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retry pipeline run ${id}: ${errorMessage}`);
      throw new BadRequestException('Failed to retry pipeline run');
    }
  }

  /**
   * 获取流水线运行统计信息
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
    try {
      const whereConditions = [];

      if (pipelineId) {
        whereConditions.push(eq(pipelineRuns.pipelineId, pipelineId));
      }
      if (projectId) {
        whereConditions.push(eq(pipelines.projectId, projectId));
      }
      if (dateFrom) {
        whereConditions.push(gte(pipelineRuns.createdAt, dateFrom));
      }
      if (dateTo) {
        whereConditions.push(lte(pipelineRuns.createdAt, dateTo));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get basic stats
      const statsQuery = this.db
        .select({
          total: count(),
          success: count(sql`CASE WHEN ${pipelineRuns.status} = 'success' THEN 1 END`),
          failure: count(sql`CASE WHEN ${pipelineRuns.status} = 'failed' THEN 1 END`),
          cancelled: count(sql`CASE WHEN ${pipelineRuns.status} = 'cancelled' THEN 1 END`),
          running: count(sql`CASE WHEN ${pipelineRuns.status} = 'running' THEN 1 END`),
          pending: count(sql`CASE WHEN ${pipelineRuns.status} = 'pending' THEN 1 END`),
          avgDuration: sql<number>`AVG(${pipelineRuns.duration})`,
          totalDuration: sql<number>`SUM(${pipelineRuns.duration})`,
        })
        .from(pipelineRuns);

      if (projectId && !pipelineId) {
        statsQuery.innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id));
      }

      if (whereClause) {
        statsQuery.where(whereClause);
      }

      const [stats] = await statsQuery;

      // Get status breakdown
      const statusQuery = this.db
        .select({
          status: pipelineRuns.status,
          count: count(),
        })
        .from(pipelineRuns);

      if (projectId && !pipelineId) {
        statusQuery.innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id));
      }

      if (whereClause) {
        statusQuery.where(whereClause);
      }

      const statusStats = await statusQuery.groupBy(pipelineRuns.status);

      // Get branch breakdown
      const branchQuery = this.db
        .select({
          branch: pipelineRuns.branch,
          count: count(),
        })
        .from(pipelineRuns);

      if (projectId && !pipelineId) {
        branchQuery.innerJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id));
      }

      if (whereClause) {
        branchQuery.where(whereClause);
      }

      const branchStats = await branchQuery.groupBy(pipelineRuns.branch);

      const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;

      return {
        total: stats.total,
        success: stats.success,
        failure: stats.failure,
        cancelled: stats.cancelled,
        running: stats.running,
        pending: stats.pending,
        successRate: Math.round(successRate * 100) / 100,
        avgDuration: Math.round((stats.avgDuration || 0) * 100) / 100,
        totalDuration: stats.totalDuration || 0,
        byStatus: statusStats.reduce((acc, item) => {
          if (item.status) {
            acc[item.status] = item.count;
          }
          return acc;
        }, {} as Record<string, number>),
        byBranch: branchStats.reduce((acc, item) => {
          if (item.branch) {
            acc[item.branch] = item.count;
          }
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get pipeline run stats: ${errorMessage}`);
      throw new BadRequestException('Failed to get pipeline run stats');
    }
  }

  /**
   * 批量取消流水线运行
   */
  async batchCancelPipelineRuns(runIds: string[]): Promise<PipelineRun[]> {
    try {
      if (runIds.length === 0) {
        return [];
      }

      const updatedRuns = await this.db
        .update(pipelineRuns)
        .set({
          status: 'cancelled',
          finishedAt: new Date(),
        })
        .where(inArray(pipelineRuns.id, runIds))
        .returning();

      this.logger.log(`Batch cancelled ${updatedRuns.length} pipeline runs`);
      return updatedRuns;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch cancel pipeline runs: ${errorMessage}`);
      throw new BadRequestException('Failed to batch cancel pipeline runs');
    }
  }

  /**
   * 删除流水线运行
   */
  async deletePipelineRun(id: string): Promise<void> {
    try {
      const result = await this.db
        .delete(pipelineRuns)
        .where(eq(pipelineRuns.id, id))
        .returning({ id: pipelineRuns.id });

      if (!result.length) {
        throw new NotFoundException(`Pipeline run with ID ${id} not found`);
      }

      this.logger.log(`Pipeline run deleted: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete pipeline run ${id}: ${errorMessage}`);
      throw new BadRequestException('Failed to delete pipeline run');
    }
  }

  /**
   * 批量删除流水线运行
   */
  async batchDeletePipelineRuns(runIds: string[]): Promise<void> {
    try {
      if (runIds.length === 0) {
        return;
      }

      const result = await this.db
        .delete(pipelineRuns)
        .where(inArray(pipelineRuns.id, runIds))
        .returning({ id: pipelineRuns.id });

      this.logger.log(`Batch deleted ${result.length} pipeline runs`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch delete pipeline runs: ${errorMessage}`);
      throw new BadRequestException('Failed to batch delete pipeline runs');
    }
  }

  /**
   * 获取最近的流水线运行记录
   */
  async getRecentPipelineRuns(limit: number = 10): Promise<PipelineRunWithDetails[]> {
    try {
      const results = await this.db
        .select(this.selectFields)
        .from(pipelineRuns)
        .leftJoin(pipelines, eq(pipelineRuns.pipelineId, pipelines.id))
        .leftJoin(users, eq(pipelineRuns.triggerUserId, users.id))
        .orderBy(desc(pipelineRuns.createdAt))
        .limit(limit);

      return results.map(result => this.mapPipelineRunWithDetails(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recent pipeline runs: ${errorMessage}`);
      throw new BadRequestException('Failed to get recent pipeline runs');
    }
  }
}