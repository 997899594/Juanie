import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { 
  deployments, 
  type NewDeployment, 
  type UpdateDeployment,
  type Deployment,
  type DeploymentStatus,
  type DeploymentStrategy,
  type RollbackStrategy
} from '../../database/schemas';

export interface DeploymentFilters {
  page?: number;
  limit?: number;
  status?: DeploymentStatus;
  environmentId?: string;
  deployedBy?: string;
  branch?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface DeploymentStats {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  running: number;
  pending: number;
  rolledBack: number;
  successRate: number;
  avgDeploymentTime: number;
  totalDeploymentCost: number;
  byEnvironment: Record<string, number>;
  byStatus: Record<string, number>;
  byStrategy: Record<string, number>;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  riskFactors: string[];
  recommendations: string[];
}

export interface PerformancePrediction {
  predictedResponseTime: number;
  predictedThroughput: number;
  predictedAvailability: number;
  confidence: number;
}

@Injectable()
export class DeploymentsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 创建部署
   */
  async createDeployment(data: NewDeployment): Promise<Deployment> {
    const [deployment] = await this.db.database
      .insert(deployments)
      .values(data)
      .returning();

    if (!deployment) {
      throw new Error('Failed to create deployment');
    }

    return deployment;
  }

  /**
   * 根据ID获取部署
   */
  async getDeploymentById(id: string): Promise<Deployment | null> {
    const [deployment] = await this.db.database
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    return deployment || null;
  }

  /**
   * 获取项目的部署列表
   */
  async getDeploymentsByProject(
    projectId: string,
    filters: DeploymentFilters = {}
  ): Promise<{
    deployments: Deployment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      environmentId,
      deployedBy,
      branch,
      dateFrom,
      dateTo,
    } = filters;

    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [eq(deployments.projectId, projectId)];

    if (status) {
      conditions.push(eq(deployments.status, status));
    }
    if (environmentId) {
      conditions.push(eq(deployments.environmentId, environmentId));
    }
    if (deployedBy) {
      conditions.push(eq(deployments.deployedBy, deployedBy));
    }
    if (branch) {
      conditions.push(eq(deployments.branch, branch));
    }
    if (dateFrom) {
      conditions.push(gte(deployments.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(deployments.createdAt, dateTo));
    }

    const whereClause = and(...conditions);

    // 获取总数
    const [{ count: total }] = await this.db.database
      .select({ count: count() })
      .from(deployments)
      .where(whereClause);

    // 获取部署列表
    const deploymentsList = await this.db.database
      .select()
      .from(deployments)
      .where(whereClause)
      .orderBy(desc(deployments.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      deployments: deploymentsList,
      total,
      page,
      limit,
    };
  }

  /**
   * 获取环境的部署列表
   */
  async getDeploymentsByEnvironment(
    environmentId: string,
    filters: Omit<DeploymentFilters, 'environmentId'> = {}
  ): Promise<{
    deployments: Deployment[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.getDeploymentsByProject('', { ...filters, environmentId });
  }

  /**
   * 更新部署
   */
  async updateDeployment(id: string, data: UpdateDeployment): Promise<Deployment> {
    const [deployment] = await this.db.database
      .update(deployments)
      .set(data)
      .where(eq(deployments.id, id))
      .returning();

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    return deployment;
  }

  /**
   * 开始部署
   */
  async startDeployment(id: string): Promise<Deployment> {
    return this.updateDeployment(id, {
      status: 'running',
      startedAt: new Date(),
    });
  }

  /**
   * 完成部署
   */
  async finishDeployment(
    id: string,
    status: 'success' | 'failed' | 'cancelled',
    metrics?: {
      avgResponseTime?: number;
      throughputRps?: number;
      availability?: number;
      errorRate?: number;
      responseTimeP95?: number;
      cpuUsageAvg?: number;
      memoryUsageAvg?: number;
      diskUsageGb?: number;
      deploymentCost?: number;
    }
  ): Promise<Deployment> {
    const updateData: UpdateDeployment = {
      status,
      finishedAt: new Date(),
      ...metrics,
    };

    return this.updateDeployment(id, updateData);
  }

  /**
   * 回滚部署
   */
  async rollbackDeployment(
    id: string,
    reason: string,
    rollbackDuration?: number
  ): Promise<Deployment> {
    return this.updateDeployment(id, {
      status: 'rolled_back',
      rollbackReason: reason,
      rolledBackAt: new Date(),
      rollbackDuration,
    });
  }

  /**
   * 取消部署
   */
  async cancelDeployment(id: string): Promise<Deployment> {
    return this.updateDeployment(id, {
      status: 'cancelled',
      finishedAt: new Date(),
    });
  }

  /**
   * 获取部署统计
   */
  async getDeploymentStats(
    projectId?: string,
    environmentId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<DeploymentStats> {
    const conditions = [];

    if (projectId) {
      conditions.push(eq(deployments.projectId, projectId));
    }
    if (environmentId) {
      conditions.push(eq(deployments.environmentId, environmentId));
    }
    if (dateFrom) {
      conditions.push(gte(deployments.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(deployments.createdAt, dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 基础统计
    const [stats] = await this.db.database
      .select({
        total: count(),
        success: count(sql`CASE WHEN ${deployments.status} = 'success' THEN 1 END`),
        failed: count(sql`CASE WHEN ${deployments.status} = 'failed' THEN 1 END`),
        cancelled: count(sql`CASE WHEN ${deployments.status} = 'cancelled' THEN 1 END`),
        running: count(sql`CASE WHEN ${deployments.status} = 'running' THEN 1 END`),
        pending: count(sql`CASE WHEN ${deployments.status} = 'pending' THEN 1 END`),
        rolledBack: count(sql`CASE WHEN ${deployments.status} = 'rolled_back' THEN 1 END`),
        avgDeploymentTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${deployments.finishedAt} - ${deployments.startedAt})))`,
        totalDeploymentCost: sql<number>`SUM(${deployments.deploymentCost})`,
      })
      .from(deployments)
      .where(whereClause);

    // 按环境统计
    const environmentStats = await this.db.database
      .select({
        environmentId: deployments.environmentId,
        count: count(),
      })
      .from(deployments)
      .where(whereClause)
      .groupBy(deployments.environmentId);

    // 按状态统计
    const statusStats = await this.db.database
      .select({
        status: deployments.status,
        count: count(),
      })
      .from(deployments)
      .where(whereClause)
      .groupBy(deployments.status);

    // 按策略统计
    const strategyStats = await this.db.database
      .select({
        strategy: deployments.deploymentStrategy,
        count: count(),
      })
      .from(deployments)
      .where(whereClause)
      .groupBy(deployments.deploymentStrategy);

    const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;

    return {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      cancelled: stats.cancelled,
      running: stats.running,
      pending: stats.pending,
      rolledBack: stats.rolledBack,
      successRate,
      avgDeploymentTime: stats.avgDeploymentTime || 0,
      totalDeploymentCost: stats.totalDeploymentCost || 0,
      byEnvironment: Object.fromEntries(
        environmentStats.map(s => [s.environmentId, s.count])
      ),
      byStatus: Object.fromEntries(
        statusStats.map(s => [s.status, s.count])
      ),
      byStrategy: Object.fromEntries(
        strategyStats.map(s => [s.strategy, s.count])
      ),
    };
  }

  /**
   * 批量更新部署状态
   */
  async batchUpdateDeploymentStatus(
    deploymentIds: string[],
    status: DeploymentStatus
  ): Promise<Deployment[]> {
    const updatedDeployments = await this.db.database
      .update(deployments)
      .set({ status })
      .where(inArray(deployments.id, deploymentIds))
      .returning();

    return updatedDeployments;
  }

  /**
   * 删除部署
   */
  async deleteDeployment(id: string): Promise<void> {
    await this.db.database
      .delete(deployments)
      .where(eq(deployments.id, id));
  }

  /**
   * 批量删除部署
   */
  async batchDeleteDeployments(deploymentIds: string[]): Promise<void> {
    await this.db.database
      .delete(deployments)
      .where(inArray(deployments.id, deploymentIds));
  }

  /**
   * 获取最近的部署
   */
  async getRecentDeployments(
    projectId: string,
    limit: number = 10
  ): Promise<Deployment[]> {
    return this.db.database
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt))
      .limit(limit);
  }

  /**
   * 获取活跃的部署
   */
  async getActiveDeployments(projectId?: string): Promise<Deployment[]> {
    const conditions = [
      sql`${deployments.status} IN ('pending', 'running')`
    ];

    if (projectId) {
      conditions.push(eq(deployments.projectId, projectId));
    }

    return this.db.database
      .select()
      .from(deployments)
      .where(and(...conditions))
      .orderBy(desc(deployments.createdAt));
  }

  /**
   * AI风险评估
   */
  async assessDeploymentRisk(
    projectId: string,
    environmentId: string,
    commitHash: string,
    branch: string
  ): Promise<RiskAssessment> {
    // 获取历史部署数据进行风险评估
    const recentDeployments = await this.db.database
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.projectId, projectId),
          eq(deployments.environmentId, environmentId)
        )
      )
      .orderBy(desc(deployments.createdAt))
      .limit(50);

    // 简化的风险评估逻辑
    const failureRate = recentDeployments.length > 0 
      ? recentDeployments.filter(d => d.status === 'failed').length / recentDeployments.length
      : 0;

    const rollbackRate = recentDeployments.length > 0
      ? recentDeployments.filter(d => d.status === 'rolled_back').length / recentDeployments.length
      : 0;

    let riskScore = Math.round((failureRate + rollbackRate) * 100);
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    if (failureRate > 0.2) {
      riskFactors.push('High failure rate in recent deployments');
      recommendations.push('Consider additional testing before deployment');
      riskScore += 20;
    }

    if (rollbackRate > 0.1) {
      riskFactors.push('Recent rollbacks detected');
      recommendations.push('Review rollback procedures and monitoring');
      riskScore += 15;
    }

    if (branch !== 'main' && branch !== 'master') {
      riskFactors.push('Deploying from non-main branch');
      recommendations.push('Ensure feature branch is properly tested');
      riskScore += 10;
    }

    // 确定风险等级
    if (riskScore >= 60) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    }

    return {
      riskLevel,
      riskScore: Math.min(riskScore, 100),
      riskFactors,
      recommendations,
    };
  }

  /**
   * AI性能预测
   */
  async predictDeploymentPerformance(
    projectId: string,
    environmentId: string
  ): Promise<PerformancePrediction> {
    // 获取历史性能数据
    const recentSuccessfulDeployments = await this.db.database
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.projectId, projectId),
          eq(deployments.environmentId, environmentId),
          eq(deployments.status, 'success')
        )
      )
      .orderBy(desc(deployments.createdAt))
      .limit(20);

    if (recentSuccessfulDeployments.length === 0) {
      // 默认预测值
      return {
        predictedResponseTime: 200,
        predictedThroughput: 1000,
        predictedAvailability: 99.9,
        confidence: 0.3,
      };
    }

    // 计算平均值作为预测
    const avgResponseTime = recentSuccessfulDeployments
      .filter(d => d.avgResponseTime)
      .reduce((sum, d) => sum + (d.avgResponseTime || 0), 0) / 
      recentSuccessfulDeployments.filter(d => d.avgResponseTime).length || 200;

    const avgThroughput = recentSuccessfulDeployments
      .filter(d => d.throughputRps)
      .reduce((sum, d) => sum + (d.throughputRps || 0), 0) / 
      recentSuccessfulDeployments.filter(d => d.throughputRps).length || 1000;

    const avgAvailability = recentSuccessfulDeployments
      .filter(d => d.availability)
      .reduce((sum, d) => sum + Number(d.availability || 0), 0) / 
      recentSuccessfulDeployments.filter(d => d.availability).length || 99.9;

    const confidence = Math.min(recentSuccessfulDeployments.length / 20, 1);

    return {
      predictedResponseTime: Math.round(avgResponseTime),
      predictedThroughput: Math.round(avgThroughput),
      predictedAvailability: Number(avgAvailability.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
    };
  }

  /**
   * 获取部署环境使用情况
   */
  async getEnvironmentUsage(environmentId: string): Promise<{
    activeDeployments: number;
    totalDeployments: number;
    lastDeployment?: Deployment;
  }> {
    const [stats] = await this.db.database
      .select({
        total: count(),
        active: count(sql`CASE WHEN ${deployments.status} IN ('pending', 'running') THEN 1 END`),
      })
      .from(deployments)
      .where(eq(deployments.environmentId, environmentId));

    const [lastDeployment] = await this.db.database
      .select()
      .from(deployments)
      .where(eq(deployments.environmentId, environmentId))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    return {
      activeDeployments: stats.active,
      totalDeployments: stats.total,
      lastDeployment: lastDeployment || undefined,
    };
  }
}