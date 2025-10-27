import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, sql, gte, lte, inArray, like } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { experiments, type Experiment, type NewExperiment, type UpdateExperiment } from '../../database/schemas/experiments.schema';

@Injectable()
export class ExperimentsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  // 创建实验
  async create(data: NewExperiment): Promise<Experiment> {
    const [result] = await this.db
      .insert(experiments)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  // 根据ID获取实验
  async findById(id: string): Promise<Experiment | null> {
    const [result] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.id, id))
      .limit(1);
    return result || null;
  }

  // 根据项目获取实验列表
  async findByProject(projectId: string, limit = 50, offset = 0): Promise<Experiment[]> {
    return await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.projectId, projectId))
      .orderBy(desc(experiments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 根据状态获取实验列表
  async findByStatus(status: string, projectId?: string, limit = 50, offset = 0): Promise<Experiment[]> {
    const conditions = [eq(experiments.status, status)];
    if (projectId) {
      conditions.push(eq(experiments.projectId, projectId));
    }

    return await this.db
      .select()
      .from(experiments)
      .where(and(...conditions))
      .orderBy(desc(experiments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 搜索实验
  async search(query: string, projectId?: string, limit = 50, offset = 0): Promise<Experiment[]> {
    const conditions = [
      like(experiments.name, `%${query}%`)
    ];
    if (projectId) {
      conditions.push(eq(experiments.projectId, projectId));
    }

    return await this.db
      .select()
      .from(experiments)
      .where(and(...conditions))
      .orderBy(desc(experiments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 更新实验
  async update(id: string, data: UpdateExperiment): Promise<Experiment | null> {
    const [result] = await this.db
      .update(experiments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(experiments.id, id))
      .returning();
    return result || null;
  }

  // 启动实验
  async start(id: string): Promise<Experiment | null> {
    const [result] = await this.db
      .update(experiments)
      .set({
        status: 'running',
        startDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(experiments.id, id))
      .returning();
    return result || null;
  }

  // 停止实验
  async stop(id: string, conclusion?: string): Promise<Experiment | null> {
    const [result] = await this.db
      .update(experiments)
      .set({
        status: 'stopped',
        endDate: new Date(),
        experimentConclusion: conclusion,
        updatedAt: new Date(),
      })
      .where(eq(experiments.id, id))
      .returning();
    return result || null;
  }

  // 完成实验
  async complete(id: string, results: {
    conclusion: string;
    primaryMetricResult: number;
    statisticalSignificanceAchieved: boolean;
    winnerVariant?: string;
  }): Promise<Experiment | null> {
    const [result] = await this.db
      .update(experiments)
      .set({
        status: 'completed',
        endDate: new Date(),
        experimentConclusion: results.conclusion,
        primaryMetricResult: results.primaryMetricResult.toString(),
        statisticalSignificanceAchieved: results.statisticalSignificanceAchieved,
        statisticalSignificance: results.statisticalSignificanceAchieved,
        winnerVariant: results.winnerVariant,
        updatedAt: new Date(),
      })
      .where(eq(experiments.id, id))
      .returning();
    return result || null;
  }

  // 删除实验
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(experiments)
      .where(eq(experiments.id, id));
    return (result.count || 0) > 0;
  }

  // 批量删除实验
  async batchDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const result = await this.db
      .delete(experiments)
      .where(inArray(experiments.id, ids));
    return result.count || 0;
  }



  // 获取实验统计信息
  async getExperimentStats(projectId?: string): Promise<{
    totalExperiments: number;
    runningExperiments: number;
    completedExperiments: number;
    draftExperiments: number;
    stoppedExperiments: number;
    successfulExperiments: number;
    avgDuration: number;
    statusDistribution: Record<string, number>;
  }> {
    const conditions = projectId ? [eq(experiments.projectId, projectId)] : [];

    const [stats] = await this.db
      .select({
        totalExperiments: sql<number>`COUNT(*)`,
        runningExperiments: sql<number>`COUNT(CASE WHEN ${experiments.status} = 'running' THEN 1 END)`,
        completedExperiments: sql<number>`COUNT(CASE WHEN ${experiments.status} = 'completed' THEN 1 END)`,
        draftExperiments: sql<number>`COUNT(CASE WHEN ${experiments.status} = 'draft' THEN 1 END)`,
        stoppedExperiments: sql<number>`COUNT(CASE WHEN ${experiments.status} = 'stopped' THEN 1 END)`,
        successfulExperiments: sql<number>`COUNT(CASE WHEN ${experiments.statisticalSignificanceAchieved} = true THEN 1 END)`,
        avgDuration: sql<number>`AVG(${experiments.durationDays})`,
      })
      .from(experiments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // 获取状态分布
    const statusDistribution = await this.db
      .select({
        status: experiments.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(experiments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(experiments.status);

    const statusDistributionMap = statusDistribution.reduce((acc, item) => {
      acc[item.status || 'unknown'] = Number(item.count);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExperiments: Number(stats.totalExperiments),
      runningExperiments: Number(stats.runningExperiments),
      completedExperiments: Number(stats.completedExperiments),
      draftExperiments: Number(stats.draftExperiments),
      stoppedExperiments: Number(stats.stoppedExperiments),
      successfulExperiments: Number(stats.successfulExperiments),
      avgDuration: Number(stats.avgDuration) || 0,
      statusDistribution: statusDistributionMap,
    };
  }

  // 获取实验性能分析
  async getExperimentPerformance(id: string): Promise<{
    experimentId: string;
    name: string;
    status: string;
    duration: number;
    sampleSize: number;
    conversionRate: number;
    confidenceLevel: number;
    statisticalPower: number;
    isSignificant: boolean;
    variants: Array<{
      name: string;
      type: string;
      trafficAllocation: number;
      performance: number;
    }>;
    recommendations: string[];
  } | null> {
    const experiment = await this.findById(id);
    if (!experiment) return null;

    // 计算实验持续时间
    const duration = experiment.startDate && experiment.endDate
      ? Math.ceil((experiment.endDate.getTime() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : experiment.durationDays || 0;

    // 模拟变体数据（实际应用中应从实际数据源获取）
    const variants = [
      {
        name: experiment.controlVariantName,
        type: 'control',
        trafficAllocation: 50,
        performance: Math.random() * 100,
      }
    ];

    // 添加测试变体
    if (experiment.testVariantNames) {
      const testVariantNames = experiment.testVariantNames.split(',');
      testVariantNames.forEach((name, index) => {
        variants.push({
          name: name.trim(),
          type: 'treatment',
          trafficAllocation: 50 / testVariantNames.length,
          performance: Math.random() * 100,
        });
      });
    }

    // 生成建议
    const recommendations = this.generateExperimentRecommendations(experiment);

    return {
      experimentId: experiment.id,
      name: experiment.name,
      status: experiment.status || 'draft',
      duration,
      sampleSize: experiment.minimumSampleSize || 0,
      conversionRate: Number(experiment.primaryMetricResult) || 0,
      confidenceLevel: Number(experiment.confidenceLevel) || 0.95,
      statisticalPower: Number(experiment.statisticalPower) || 0.80,
      isSignificant: experiment.statisticalSignificanceAchieved || false,
      variants,
      recommendations,
    };
  }

  // 生成实验建议
  private generateExperimentRecommendations(experiment: Experiment): string[] {
    const recommendations: string[] = [];

    // 基于实验状态生成建议
    if (experiment.status === 'draft') {
      recommendations.push('实验尚未开始，建议检查配置后启动');
    }

    if (experiment.status === 'running') {
      if (experiment.realTimeMonitoring) {
        recommendations.push('实验正在运行，建议持续监控关键指标');
      }
      if (experiment.autoStopEnabled) {
        recommendations.push('已启用自动停止条件，系统将自动评估停止时机');
      }
    }

    // 基于样本量生成建议
    if (experiment.minimumSampleSize && experiment.minimumSampleSize < 1000) {
      recommendations.push('样本量较小，建议增加样本量以提高统计可靠性');
    }

    // 基于置信度生成建议
    const confidenceLevel = Number(experiment.confidenceLevel) || 0.95;
    if (confidenceLevel < 0.95) {
      recommendations.push('置信度较低，建议提高到95%以上');
    }

    // 基于实验持续时间生成建议
    if (experiment.durationDays && experiment.durationDays < 7) {
      recommendations.push('实验持续时间较短，建议至少运行一周以获得稳定结果');
    }

    // 基于AI分析生成建议
    if (experiment.aiAnalysisEnabled) {
      recommendations.push('已启用AI分析，将提供智能化的实验洞察');
    } else {
      recommendations.push('建议启用AI分析以获得更深入的实验洞察');
    }

    if (recommendations.length === 0) {
      recommendations.push('实验配置良好，继续按计划执行');
    }

    return recommendations;
  }

  // 获取实验趋势分析
  async getExperimentTrends(
    projectId?: string,
    days: number = 30
  ): Promise<Array<{
    date: string;
    experimentsStarted: number;
    experimentsCompleted: number;
    successRate: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conditions = [gte(experiments.createdAt, startDate)];
    if (projectId) {
      conditions.push(eq(experiments.projectId, projectId));
    }

    const results = await this.db
      .select({
        date: sql<string>`DATE(${experiments.createdAt})`,
        experimentsStarted: sql<number>`COUNT(CASE WHEN ${experiments.status} = 'running' THEN 1 END)`,
        experimentsCompleted: sql<number>`COUNT(CASE WHEN ${experiments.status} = 'completed' THEN 1 END)`,
        successfulExperiments: sql<number>`COUNT(CASE WHEN ${experiments.statisticalSignificanceAchieved} = true THEN 1 END)`,
        totalExperiments: sql<number>`COUNT(*)`,
      })
      .from(experiments)
      .where(and(...conditions))
      .groupBy(sql`DATE(${experiments.createdAt})`)
      .orderBy(sql`DATE(${experiments.createdAt})`);

    return results.map(item => ({
      date: item.date,
      experimentsStarted: Number(item.experimentsStarted),
      experimentsCompleted: Number(item.experimentsCompleted),
      successRate: Number(item.totalExperiments) > 0 
        ? (Number(item.successfulExperiments) / Number(item.totalExperiments)) * 100 
        : 0,
    }));
  }

  // 检查自动停止条件
  async checkAutoStopConditions(id: string): Promise<{
    shouldStop: boolean;
    reason?: string;
    recommendation: string;
  }> {
    const experiment = await this.findById(id);
    if (!experiment || !experiment.autoStopEnabled) {
      return {
        shouldStop: false,
        recommendation: '自动停止未启用或实验不存在',
      };
    }

    // 检查最小样本量
    if (experiment.autoStopMinSampleSize && experiment.minimumSampleSize) {
      if (experiment.minimumSampleSize >= experiment.autoStopMinSampleSize) {
        return {
          shouldStop: true,
          reason: 'minimum_sample_size_reached',
          recommendation: '已达到最小样本量，建议停止实验',
        };
      }
    }

    // 检查最大持续时间
    if (experiment.autoStopMaxDuration && experiment.startDate) {
      const daysSinceStart = Math.ceil(
        (new Date().getTime() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceStart >= experiment.autoStopMaxDuration) {
        return {
          shouldStop: true,
          reason: 'max_duration_exceeded',
          recommendation: '已达到最大持续时间，建议停止实验',
        };
      }
    }

    // 检查置信度
    if (experiment.autoStopConfidenceLevel && experiment.statisticalSignificanceAchieved) {
      const currentConfidence = Number(experiment.confidenceLevel) || 0.95;
      const targetConfidence = Number(experiment.autoStopConfidenceLevel);
      if (currentConfidence >= targetConfidence) {
        return {
          shouldStop: true,
          reason: 'confidence_level_reached',
          recommendation: '已达到目标置信度，建议停止实验',
        };
      }
    }

    return {
      shouldStop: false,
      recommendation: '实验可以继续运行',
    };
  }
}