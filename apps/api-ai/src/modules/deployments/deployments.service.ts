import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
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
  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建部署
   */
  async createDeployment(data: NewDeployment): Promise<Deployment> {
    const [deployment] = await this.db
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
    const [deployment] = await this.db
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
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(deployments)
      .where(whereClause);

    // 获取部署列表
    const deploymentsList = await this.db
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
    const [deployment] = await this.db
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
      avgResponseTime: metrics?.avgResponseTime,
      throughputRps: metrics?.throughputRps,
      availability: metrics?.availability?.toString(),
      errorRate: metrics?.errorRate?.toString(),
      responseTimeP95: metrics?.responseTimeP95,
      cpuUsageAvg: metrics?.cpuUsageAvg?.toString(),
      memoryUsageAvg: metrics?.memoryUsageAvg?.toString(),
      diskUsageGb: metrics?.diskUsageGb?.toString(),
      deploymentCost: metrics?.deploymentCost?.toString(),
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
    const [stats] = await this.db
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
    const environmentStats = await this.db
      .select({
        environmentId: deployments.environmentId,
        count: count(),
      })
      .from(deployments)
      .where(whereClause)
      .groupBy(deployments.environmentId);

    // 按状态统计
    const statusStats = await this.db
      .select({
        status: deployments.status,
        count: count(),
      })
      .from(deployments)
      .where(whereClause)
      .groupBy(deployments.status);

    // 按策略统计
    const strategyStats = await this.db
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
    const updatedDeployments = await this.db
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
    await this.db
      .delete(deployments)
      .where(eq(deployments.id, id));
  }

  /**
   * 批量删除部署
   */
  async batchDeleteDeployments(deploymentIds: string[]): Promise<void> {
    await this.db
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
    return this.db
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
    const whereClause = projectId
      ? and(
          eq(deployments.projectId, projectId),
          inArray(deployments.status, ['running', 'pending'])
        )
      : inArray(deployments.status, ['running', 'pending']);

    return this.db
      .select()
      .from(deployments)
      .where(whereClause)
      .orderBy(desc(deployments.createdAt));
  }

  /**
   * 评估部署风险
   */
  async assessDeploymentRisk(
    projectId: string,
    environmentId: string,
    commitHash: string,
    branch: string
  ): Promise<RiskAssessment> {
    // 获取最近的部署历史
    const recentDeployments = await this.db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.projectId, projectId),
          eq(deployments.environmentId, environmentId)
        )
      )
      .orderBy(desc(deployments.createdAt))
      .limit(10);

    // 计算风险因子
    const riskFactors: string[] = [];
    let riskScore = 0;

    // 检查失败率
    const failedDeployments = recentDeployments.filter((d: any) => d.status === 'failed');
    const failureRate = failedDeployments.length / recentDeployments.length;
    
    if (failureRate > 0.3) {
      riskFactors.push('High failure rate in recent deployments');
      riskScore += 30;
    } else if (failureRate > 0.1) {
      riskFactors.push('Moderate failure rate in recent deployments');
      riskScore += 15;
    }

    // 检查部署频率
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentCount = recentDeployments.filter((d: any) => new Date(d.createdAt) > oneDayAgo).length;
    
    if (recentCount > 5) {
      riskFactors.push('High deployment frequency');
      riskScore += 20;
    }

    // 检查分支
    if (branch !== 'main' && branch !== 'master') {
      riskFactors.push('Deploying from non-main branch');
      riskScore += 10;
    }

    // 确定风险等级
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 40) {
      riskLevel = 'high';
    } else if (riskScore >= 20) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // 生成建议
    const recommendations: string[] = [];
    if (riskLevel === 'high') {
      recommendations.push('Consider running additional tests before deployment');
      recommendations.push('Deploy during low-traffic hours');
      recommendations.push('Have rollback plan ready');
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor deployment closely');
      recommendations.push('Ensure proper testing coverage');
    } else {
      recommendations.push('Deployment looks safe to proceed');
    }

    return {
      riskLevel,
      riskScore,
      riskFactors,
      recommendations,
    };
  }

  /**
   * 预测部署性能
   */
  async predictDeploymentPerformance(
    projectId: string,
    environmentId: string
  ): Promise<PerformancePrediction> {
    // 获取最近成功的部署数据
    const recentSuccessfulDeployments = await this.db
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
      .limit(5);

    if (recentSuccessfulDeployments.length === 0) {
      return {
        predictedResponseTime: 100,
        predictedThroughput: 1000,
        predictedAvailability: 99.0,
        confidence: 0.1,
      };
    }

    // 计算平均值
    const avgResponseTime = recentSuccessfulDeployments.reduce(
      (sum: number, d: any) => sum + (d.avgResponseTime || 100),
      0
    ) / recentSuccessfulDeployments.length;

    const avgThroughput = recentSuccessfulDeployments.reduce(
      (sum: number, d: any) => sum + (d.throughputRps || 1000),
      0
    ) / recentSuccessfulDeployments.length;

    const avgAvailability = recentSuccessfulDeployments.reduce(
      (sum: number, d: any) => sum + (parseFloat(d.availability) || 99.0),
      0
    ) / recentSuccessfulDeployments.length;

    // 计算置信度
    const confidence = Math.min(recentSuccessfulDeployments.length / 5, 1);

    return {
      predictedResponseTime: Math.round(avgResponseTime),
      predictedThroughput: Math.round(avgThroughput),
      predictedAvailability: Math.round(avgAvailability * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /**
   * 获取环境使用情况
   */
  async getEnvironmentUsage(environmentId: string): Promise<{
    activeDeployments: number;
    totalDeployments: number;
    lastDeployment?: Deployment;
  }> {
    // 获取统计信息
    const [stats] = await this.db
      .select({
        total: count(),
        active: count(sql`CASE WHEN ${deployments.status} IN ('running', 'pending') THEN 1 END`),
      })
      .from(deployments)
      .where(eq(deployments.environmentId, environmentId));

    // 获取最后一次部署
    const [lastDeployment] = await this.db
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