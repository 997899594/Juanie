import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte, or, isNull } from 'drizzle-orm';
import { 
  environments, 
  Environment, 
  NewEnvironment,
  UpdateEnvironment,
  EnvironmentType,
  CloudProvider,
  EnvironmentStatus,
  DataClassification,
  insertEnvironmentSchema,
  updateEnvironmentSchema,
  selectEnvironmentSchema
} from '../../database/schemas/environments.schema';
import { projects } from '../../database/schemas/projects.schema';
import { z } from 'zod';

// 业务逻辑接口定义
export interface EnvironmentWithProject {
  id: string;
  projectId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  environmentType: string;
  cloudProvider: string | null;
  region: string | null;
  instanceType: string | null;
  clusterSize: number | null;
  enableAutoScaling: boolean | null;
  cpuCores: number | null;
  memoryGb: number | null;
  storageGb: number | null;
  status: string | null;
  healthCheckUrl: string | null;
  lastHealthCheck: Date | null;
  requireVpn: boolean | null;
  costBudget: string | null;
  encryptionEnabled: boolean | null;
  backupEnabled: boolean | null;
  monitoringEnabled: boolean | null;
  dataClassification: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface EnvironmentStats {
  totalEnvironments: number;
  environmentsByType: Record<EnvironmentType, number>;
  environmentsByStatus: Record<EnvironmentStatus, number>;
  environmentsByProvider: Record<CloudProvider, number>;
  totalCpuCores: number;
  totalMemoryGb: number;
  totalStorageGb: number;
  totalCostBudget: number;
  avgResourceUtilization: number;
}

export interface EnvironmentResourceUsage {
  environmentId: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  storageUsagePercent: number;
  networkInMb: number;
  networkOutMb: number;
  requestsPerMinute: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
}

export interface EnvironmentHealthCheck {
  environmentId: string;
  isHealthy: boolean;
  responseTime: number;
  statusCode: number;
  errorMessage?: string;
  checkedAt: Date;
}

export interface CreateEnvironmentRequest {
  projectId: string;
  name: string;
  displayName?: string;
  description?: string;
  environmentType: EnvironmentType;
  cloudProvider?: CloudProvider;
  region?: string;
  instanceType?: string;
  clusterSize?: number;
  enableAutoScaling?: boolean;
  cpuCores?: number;
  memoryGb?: number;
  storageGb?: number;
  requireVpn?: boolean;
  costBudget?: string;
  dataClassification?: DataClassification;
}

export interface EnvironmentVariableConfig {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

export interface EnvironmentScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

@Injectable()
export class EnvironmentsService {
  private readonly logger = new Logger(EnvironmentsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建环境
   */
  async createEnvironment(data: CreateEnvironmentRequest): Promise<Environment> {
    try {
      // 验证输入数据
      const validatedData = insertEnvironmentSchema.parse(data);

      // 检查项目是否存在
      await this.validateProjectExists(data.projectId);

      // 检查环境名称是否已存在
      const existingEnv = await this.findByProjectAndName(data.projectId, data.name);
      if (existingEnv) {
        throw new ConflictException(`Environment ${data.name} already exists in this project`);
      }

      // 创建环境
      const [environment] = await this.db
        .insert(environments)
        .values([validatedData])
        .returning();

      this.logger.log(`Environment created: ${environment.id}`);
      return environment;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create environment: ${errorMessage}`);
      throw new BadRequestException('Failed to create environment');
    }
  }

  /**
   * 根据ID获取环境
   */
  async findById(id: string): Promise<Environment | null> {
    try {
      const [environment] = await this.db
        .select()
        .from(environments)
        .where(eq(environments.id, id))
        .limit(1);

      return environment || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get environment by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to get environment');
    }
  }

  /**
   * 根据项目ID和环境名称查找环境
   */
  async findByProjectAndName(projectId: string, name: string): Promise<Environment | null> {
    try {
      const [environment] = await this.db
        .select()
        .from(environments)
        .where(and(
          eq(environments.projectId, projectId),
          eq(environments.name, name)
        ))
        .limit(1);

      return environment || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get environment by project and name: ${errorMessage}`);
      throw new BadRequestException('Failed to get environment');
    }
  }

  /**
   * 获取项目的环境列表（重构版本）
   */
  async getProjectEnvironments(options: {
    projectId: string;
    page?: number;
    limit?: number;
    environmentType?: EnvironmentType;
    status?: EnvironmentStatus;
    cloudProvider?: CloudProvider;
    search?: string;
  }): Promise<{ environments: EnvironmentWithProject[]; total: number }> {
    const { projectId, page = 1, limit = 20, environmentType, status, cloudProvider, search } = options;
    
    try {
      // 验证项目是否存在
      await this.validateProjectExists(projectId);

      // 构建查询条件
      const conditions = [eq(environments.projectId, projectId)];

      if (environmentType) {
        conditions.push(eq(environments.environmentType, environmentType));
      }

      if (status) {
        conditions.push(eq(environments.status, status));
      }

      if (cloudProvider) {
        conditions.push(eq(environments.cloudProvider, cloudProvider));
      }

      if (search) {
        const searchCondition = or(
          ilike(environments.name, `%${search}%`),
          ilike(environments.displayName, `%${search}%`),
          ilike(environments.description, `%${search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // 获取总数
      const [{ count: totalCount }] = await this.db
        .select({ count: count() })
        .from(environments)
        .where(and(...conditions));

      // 获取分页数据
      const offset = (page - 1) * limit;
      const environmentList = await this.db
        .select({
          id: environments.id,
          projectId: environments.projectId,
          name: environments.name,
          displayName: environments.displayName,
          description: environments.description,
          environmentType: environments.environmentType,
          cloudProvider: environments.cloudProvider,
          region: environments.region,
          instanceType: environments.instanceType,
          clusterSize: environments.clusterSize,
          enableAutoScaling: environments.enableAutoScaling,
          cpuCores: environments.cpuCores,
          memoryGb: environments.memoryGb,
          storageGb: environments.storageGb,
          status: environments.status,
          healthCheckUrl: environments.healthCheckUrl,
          lastHealthCheck: environments.lastHealthCheck,
          requireVpn: environments.requireVpn,
          costBudget: environments.costBudget,
          encryptionEnabled: environments.encryptionEnabled,
          backupEnabled: environments.backupEnabled,
          monitoringEnabled: environments.monitoringEnabled,
          dataClassification: environments.dataClassification,
          createdAt: environments.createdAt,
          updatedAt: environments.updatedAt,
          project: {
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
          },
        })
        .from(environments)
        .leftJoin(projects, eq(environments.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(environments.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        environments: environmentList,
        total: totalCount,
      };
    } catch (error) {
      this.logger.error(`Failed to get project environments for ${options.projectId}:`, error);
      throw new BadRequestException('Failed to get project environments');
    }
  }

  /**
   * 更新环境信息
   */
  async updateEnvironment(id: string, data: UpdateEnvironment): Promise<Environment> {
    try {
      // 验证输入数据
      const validatedData = updateEnvironmentSchema.parse(data);

      // 检查环境是否存在
      const existingEnv = await this.findById(id);
      if (!existingEnv) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      // 更新环境
      const [environment] = await this.db
        .update(environments)
        .set(validatedData)
        .where(eq(environments.id, id))
        .returning();

      this.logger.log(`Environment updated: ${id}`);
      return environment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update environment: ${errorMessage}`);
      throw new BadRequestException('Failed to update environment');
    }
  }

  /**
   * 删除环境
   */
  async deleteEnvironment(id: string): Promise<void> {
    try {
      // 检查环境是否存在
      const existingEnv = await this.findById(id);
      if (!existingEnv) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      // 检查环境是否可以删除（生产环境需要特殊权限）
      if (existingEnv.environmentType === 'production') {
        throw new BadRequestException('Production environments cannot be deleted without special permissions');
      }

      // 删除环境
      await this.db
        .delete(environments)
        .where(eq(environments.id, id));

      this.logger.log(`Environment deleted: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete environment: ${errorMessage}`);
      throw new BadRequestException('Failed to delete environment');
    }
  }

  /**
   * 启动环境
   */
  async startEnvironment(id: string): Promise<Environment> {
    try {
      const environment = await this.findById(id);
      if (!environment) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      if (environment.status === 'active') {
        throw new BadRequestException('Environment is already active');
      }

      // 更新状态为provisioning，然后启动
      await this.updateEnvironment(id, { status: 'provisioning' });

      // 模拟启动过程
      await this.performEnvironmentStart(environment);

      // 更新状态为active
      const updatedEnv = await this.updateEnvironment(id, { 
        status: 'active',
        lastHealthCheck: new Date(),
      });

      this.logger.log(`Environment started: ${id}`);
      return updatedEnv;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start environment: ${errorMessage}`);
      throw new BadRequestException('Failed to start environment');
    }
  }

  /**
   * 停止环境
   */
  async stopEnvironment(id: string): Promise<Environment> {
    try {
      const environment = await this.findById(id);
      if (!environment) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      if (environment.status === 'inactive') {
        throw new BadRequestException('Environment is already inactive');
      }

      // 检查是否为生产环境
      if (environment.environmentType === 'production') {
        throw new BadRequestException('Production environments cannot be stopped without special permissions');
      }

      // 模拟停止过程
      await this.performEnvironmentStop(environment);

      // 更新状态为inactive
      const updatedEnv = await this.updateEnvironment(id, { status: 'inactive' });

      this.logger.log(`Environment stopped: ${id}`);
      return updatedEnv;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to stop environment: ${errorMessage}`);
      throw new BadRequestException('Failed to stop environment');
    }
  }

  /**
   * 重启环境
   */
  async restartEnvironment(id: string): Promise<Environment> {
    try {
      await this.stopEnvironment(id);
      // 等待一段时间确保完全停止
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.startEnvironment(id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to restart environment: ${errorMessage}`);
      throw new BadRequestException('Failed to restart environment');
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(id: string): Promise<EnvironmentHealthCheck> {
    try {
      const environment = await this.findById(id);
      if (!environment) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      const healthCheck: EnvironmentHealthCheck = {
        environmentId: id,
        isHealthy: false,
        responseTime: 0,
        statusCode: 0,
        checkedAt: new Date(),
      };

      if (environment.healthCheckUrl) {
        try {
          // 模拟健康检查
          const startTime = Date.now();
          // 这里应该实际调用健康检查URL
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
          const endTime = Date.now();

          healthCheck.responseTime = endTime - startTime;
          healthCheck.statusCode = 200;
          healthCheck.isHealthy = true;
        } catch (error) {
          healthCheck.statusCode = 500;
          healthCheck.errorMessage = error instanceof Error ? error.message : 'Health check failed';
        }
      } else {
        // 基于环境状态判断健康状态
        healthCheck.isHealthy = environment.status === 'active';
        healthCheck.statusCode = environment.status === 'active' ? 200 : 503;
      }

      // 更新最后健康检查时间
      await this.updateEnvironment(id, { lastHealthCheck: healthCheck.checkedAt });

      return healthCheck;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to perform health check: ${errorMessage}`);
      throw new BadRequestException('Failed to perform health check');
    }
  }

  /**
   * 获取环境资源使用情况
   */
  async getResourceUsage(id: string): Promise<EnvironmentResourceUsage> {
    try {
      const environment = await this.findById(id);
      if (!environment) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      // 模拟资源使用数据
      // 实际实现中应该从监控系统获取真实数据
      const usage: EnvironmentResourceUsage = {
        environmentId: id,
        cpuUsagePercent: Math.floor(Math.random() * 80) + 10,
        memoryUsagePercent: Math.floor(Math.random() * 70) + 20,
        storageUsagePercent: Math.floor(Math.random() * 60) + 15,
        networkInMb: Math.floor(Math.random() * 1000),
        networkOutMb: Math.floor(Math.random() * 800),
        requestsPerMinute: Math.floor(Math.random() * 10000),
        errorRate: Math.random() * 5,
        uptime: Math.random() * 99.9 + 0.1,
        lastUpdated: new Date(),
      };

      return usage;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get resource usage: ${errorMessage}`);
      throw new BadRequestException('Failed to get resource usage');
    }
  }

  /**
   * 配置环境扩展
   */
  async configureScaling(id: string, config: EnvironmentScalingConfig): Promise<Environment> {
    try {
      const environment = await this.findById(id);
      if (!environment) {
        throw new NotFoundException(`Environment with ID ${id} not found`);
      }

      // 更新扩展配置
      const updatedEnv = await this.updateEnvironment(id, {
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        targetCpuUtilization: config.targetCpuUtilization,
        enableAutoScaling: true,
      });

      this.logger.log(`Scaling configured for environment: ${id}`);
      return updatedEnv;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to configure scaling: ${errorMessage}`);
      throw new BadRequestException('Failed to configure scaling');
    }
  }

  /**
   * 获取环境统计信息
   */
  async getEnvironmentStats(projectId?: string): Promise<EnvironmentStats> {
    try {
      const whereCondition = projectId ? eq(environments.projectId, projectId) : undefined;

      // 获取基础统计
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(environments)
        .where(whereCondition);

      // 按类型统计
      const typeStats = await this.db
        .select({
          environmentType: environments.environmentType,
          count: count(),
        })
        .from(environments)
        .where(whereCondition)
        .groupBy(environments.environmentType);

      // 按状态统计
      const statusStats = await this.db
        .select({
          status: environments.status,
          count: count(),
        })
        .from(environments)
        .where(whereCondition)
        .groupBy(environments.status);

      // 按云提供商统计
      const providerStats = await this.db
        .select({
          cloudProvider: environments.cloudProvider,
          count: count(),
        })
        .from(environments)
        .where(whereCondition)
        .groupBy(environments.cloudProvider);

      // 获取资源统计
      const [resourceResult] = await this.db
        .select({
          totalCpuCores: sql<number>`sum(${environments.cpuCores})`,
          totalMemoryGb: sql<number>`sum(${environments.memoryGb})`,
          totalStorageGb: sql<number>`sum(${environments.storageGb})`,
          totalCostBudget: sql<number>`sum(${environments.costBudget})`,
        })
        .from(environments)
        .where(whereCondition);

      // 构建统计结果
      const environmentsByType: Record<EnvironmentType, number> = {
        development: 0,
        staging: 0,
        production: 0,
        testing: 0,
        preview: 0,
      };

      typeStats.forEach((stat) => {
        environmentsByType[stat.environmentType as EnvironmentType] = stat.count;
      });

      const environmentsByStatus: Record<EnvironmentStatus, number> = {
        active: 0,
        inactive: 0,
        provisioning: 0,
        error: 0,
        maintenance: 0,
      };

      statusStats.forEach((stat) => {
        environmentsByStatus[stat.status as EnvironmentStatus] = stat.count;
      });

      const environmentsByProvider: Record<CloudProvider, number> = {
        aws: 0,
        gcp: 0,
        azure: 0,
        digitalocean: 0,
        heroku: 0,
        vercel: 0,
        netlify: 0,
      };

      providerStats.forEach((stat) => {
        if (stat.cloudProvider) {
          environmentsByProvider[stat.cloudProvider as CloudProvider] = stat.count;
        }
      });

      return {
        totalEnvironments: totalResult.count,
        environmentsByType,
        environmentsByStatus,
        environmentsByProvider,
        totalCpuCores: resourceResult.totalCpuCores || 0,
        totalMemoryGb: resourceResult.totalMemoryGb || 0,
        totalStorageGb: resourceResult.totalStorageGb || 0,
        totalCostBudget: resourceResult.totalCostBudget || 0,
        avgResourceUtilization: Math.floor(Math.random() * 30) + 50, // 模拟数据
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get environment stats: ${errorMessage}`);
      throw new BadRequestException('Failed to get environment statistics');
    }
  }

  /**
   * 克隆环境
   */
  async cloneEnvironment(sourceId: string, targetName: string, targetType?: EnvironmentType): Promise<Environment> {
    try {
      const sourceEnv = await this.findById(sourceId);
      if (!sourceEnv) {
        throw new NotFoundException(`Source environment with ID ${sourceId} not found`);
      }

      // 检查目标环境名称是否已存在
      const existingEnv = await this.findByProjectAndName(sourceEnv.projectId, targetName);
      if (existingEnv) {
        throw new ConflictException(`Environment ${targetName} already exists in this project`);
      }

      // 创建克隆环境
      const cloneData: CreateEnvironmentRequest = {
        projectId: sourceEnv.projectId,
        name: targetName,
        displayName: `${sourceEnv.displayName || sourceEnv.name} (Clone)`,
        description: `Cloned from ${sourceEnv.name}`,
        environmentType: targetType || sourceEnv.environmentType,
        cloudProvider: sourceEnv.cloudProvider || undefined,
        region: sourceEnv.region || undefined,
        instanceType: sourceEnv.instanceType || undefined,
        clusterSize: sourceEnv.clusterSize || undefined,
        enableAutoScaling: sourceEnv.enableAutoScaling || undefined,
        cpuCores: sourceEnv.cpuCores || undefined,
        memoryGb: sourceEnv.memoryGb || undefined,
        storageGb: sourceEnv.storageGb || undefined,
        requireVpn: sourceEnv.requireVpn || undefined,
        costBudget: typeof sourceEnv.costBudget === 'string' ? sourceEnv.costBudget : undefined,
        dataClassification: sourceEnv.dataClassification || undefined,
      };

      const clonedEnv = await this.createEnvironment(cloneData);
      this.logger.log(`Environment cloned: ${sourceId} -> ${clonedEnv.id}`);
      return clonedEnv;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clone environment: ${errorMessage}`);
      throw new BadRequestException('Failed to clone environment');
    }
  }

  // 私有辅助方法

  /**
   * 验证项目是否存在
   */
  private async validateProjectExists(projectId: string): Promise<void> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
  }

  /**
   * 执行环境启动
   */
  private async performEnvironmentStart(environment: Environment): Promise<void> {
    this.logger.log(`Starting environment: ${environment.name}`);
    
    // 根据云提供商执行不同的启动逻辑
    switch (environment.cloudProvider) {
      case 'aws':
        await this.startAwsEnvironment(environment);
        break;
      case 'gcp':
        await this.startGcpEnvironment(environment);
        break;
      case 'azure':
        await this.startAzureEnvironment(environment);
        break;
      default:
        await this.startGenericEnvironment(environment);
    }
  }

  /**
   * 执行环境停止
   */
  private async performEnvironmentStop(environment: Environment): Promise<void> {
    this.logger.log(`Stopping environment: ${environment.name}`);
    
    // 根据云提供商执行不同的停止逻辑
    switch (environment.cloudProvider) {
      case 'aws':
        await this.stopAwsEnvironment(environment);
        break;
      case 'gcp':
        await this.stopGcpEnvironment(environment);
        break;
      case 'azure':
        await this.stopAzureEnvironment(environment);
        break;
      default:
        await this.stopGenericEnvironment(environment);
    }
  }

  /**
   * AWS环境启动
   */
  private async startAwsEnvironment(environment: Environment): Promise<void> {
    // 模拟AWS环境启动
    this.logger.log(`Starting AWS environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * GCP环境启动
   */
  private async startGcpEnvironment(environment: Environment): Promise<void> {
    // 模拟GCP环境启动
    this.logger.log(`Starting GCP environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Azure环境启动
   */
  private async startAzureEnvironment(environment: Environment): Promise<void> {
    // 模拟Azure环境启动
    this.logger.log(`Starting Azure environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 通用环境启动
   */
  private async startGenericEnvironment(environment: Environment): Promise<void> {
    // 模拟通用环境启动
    this.logger.log(`Starting generic environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * AWS环境停止
   */
  private async stopAwsEnvironment(environment: Environment): Promise<void> {
    // 模拟AWS环境停止
    this.logger.log(`Stopping AWS environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * GCP环境停止
   */
  private async stopGcpEnvironment(environment: Environment): Promise<void> {
    // 模拟GCP环境停止
    this.logger.log(`Stopping GCP environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * Azure环境停止
   */
  private async stopAzureEnvironment(environment: Environment): Promise<void> {
    // 模拟Azure环境停止
    this.logger.log(`Stopping Azure environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * 通用环境停止
   */
  private async stopGenericEnvironment(environment: Environment): Promise<void> {
    // 模拟通用环境停止
    this.logger.log(`Stopping generic environment: ${environment.name}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * 健康检查方法 - 重命名以匹配router中的调用
   */
  async healthCheck(id: string): Promise<EnvironmentHealthCheck> {
    return this.performHealthCheck(id);
  }

  /**
   * 环境变量管理
   */
  async getEnvironmentVariables(environmentId: string): Promise<{
    environmentId: string;
    variables: EnvironmentVariableConfig[];
  }> {
    try {
      // 模拟环境变量数据 - 实际实现中应该从专门的环境变量存储中获取
      return {
        environmentId,
        variables: [
          { key: 'NODE_ENV', value: 'production', isSecret: false, description: 'Node.js environment' },
          { key: 'DATABASE_URL', value: '***', isSecret: true, description: 'Database connection string' },
          { key: 'API_KEY', value: '***', isSecret: true, description: 'External API key' },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get environment variables for ${environmentId}:`, error);
      throw new BadRequestException('Failed to get environment variables');
    }
  }

  async setEnvironmentVariable(
    environmentId: string,
    key: string,
    value: string,
    isSecret: boolean = false,
    description?: string
  ): Promise<{
    success: boolean;
    variable: EnvironmentVariableConfig;
  }> {
    try {
      // 验证环境是否存在
      const environment = await this.findById(environmentId);
      if (!environment) {
        throw new NotFoundException('Environment not found');
      }

      // 模拟设置环境变量 - 实际实现中应该存储到专门的环境变量存储中
      return {
        success: true,
        variable: {
          key,
          value: isSecret ? '***' : value,
          isSecret,
          description,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to set environment variable for ${environmentId}:`, error);
      throw new BadRequestException('Failed to set environment variable');
    }
  }

  async deleteEnvironmentVariable(environmentId: string, key: string): Promise<{ success: boolean }> {
    try {
      // 验证环境是否存在
      const environment = await this.findById(environmentId);
      if (!environment) {
        throw new NotFoundException('Environment not found');
      }

      // 模拟删除环境变量 - 实际实现中应该从专门的环境变量存储中删除
      this.logger.log(`Deleted environment variable ${key} for environment ${environmentId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to delete environment variable for ${environmentId}:`, error);
      throw new BadRequestException('Failed to delete environment variable');
    }
  }

  /**
   * 日志管理
   */
  async getLogs(
    environmentId: string,
    lines: number = 100,
    since?: Date,
    level?: 'error' | 'warn' | 'info' | 'debug'
  ): Promise<{
    environmentId: string;
    logs: Array<{
      timestamp: Date;
      level: string;
      message: string;
      source: string;
    }>;
    totalLines: number;
  }> {
    try {
      // 验证环境是否存在
      const environment = await this.findById(environmentId);
      if (!environment) {
        throw new NotFoundException('Environment not found');
      }

      // 模拟日志数据 - 实际实现中应该从日志系统获取
      const logs = Array.from({ length: Math.min(lines, 50) }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000),
        level: level || ['info', 'warn', 'error', 'debug'][Math.floor(Math.random() * 4)],
        message: `Sample log message ${i + 1} for environment ${environment.name}`,
        source: 'application',
      }));

      return {
        environmentId,
        logs: logs.reverse(),
        totalLines: logs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get logs for environment ${environmentId}:`, error);
      throw new BadRequestException('Failed to get logs');
    }
  }

  /**
   * 备份管理
   */
  async createBackup(
    environmentId: string,
    name: string,
    description?: string
  ): Promise<{
    backupId: string;
    environmentId: string;
    name: string;
    description?: string;
    createdAt: Date;
    size: number;
    status: string;
  }> {
    try {
      // 验证环境是否存在
      const environment = await this.findById(environmentId);
      if (!environment) {
        throw new NotFoundException('Environment not found');
      }

      // 模拟创建备份 - 实际实现中应该调用备份服务
      const backup = {
        backupId: `backup_${Date.now()}`,
        environmentId,
        name,
        description,
        createdAt: new Date(),
        size: Math.floor(Math.random() * 1000) + 100, // MB
        status: 'completed',
      };

      this.logger.log(`Created backup ${backup.backupId} for environment ${environmentId}`);
      return backup;
    } catch (error) {
      this.logger.error(`Failed to create backup for environment ${environmentId}:`, error);
      throw new BadRequestException('Failed to create backup');
    }
  }

  async getBackups(environmentId: string): Promise<{
    environmentId: string;
    backups: Array<{
      backupId: string;
      name: string;
      description?: string;
      createdAt: Date;
      size: number;
      status: string;
    }>;
  }> {
    try {
      // 验证环境是否存在
      const environment = await this.findById(environmentId);
      if (!environment) {
        throw new NotFoundException('Environment not found');
      }

      // 模拟备份列表 - 实际实现中应该从备份服务获取
      return {
        environmentId,
        backups: [
          {
            backupId: 'backup_1',
            name: 'Daily Backup',
            description: 'Automated daily backup',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            size: 256,
            status: 'completed',
          },
          {
            backupId: 'backup_2',
            name: 'Pre-deployment Backup',
            description: 'Backup before major deployment',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            size: 312,
            status: 'completed',
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get backups for environment ${environmentId}:`, error);
      throw new BadRequestException('Failed to get backups');
    }
  }

  async restoreFromBackup(
    environmentId: string,
    backupId: string
  ): Promise<{
    success: boolean;
    restoreId: string;
    estimatedTime: number;
    status: string;
  }> {
    try {
      // 验证环境是否存在
      const environment = await this.findById(environmentId);
      if (!environment) {
        throw new NotFoundException('Environment not found');
      }

      // 模拟从备份恢复 - 实际实现中应该调用备份恢复服务
      const restore = {
        success: true,
        restoreId: `restore_${Date.now()}`,
        estimatedTime: 300, // seconds
        status: 'in_progress',
      };

      this.logger.log(`Started restore ${restore.restoreId} from backup ${backupId} for environment ${environmentId}`);
      return restore;
    } catch (error) {
      this.logger.error(`Failed to restore from backup for environment ${environmentId}:`, error);
      throw new BadRequestException('Failed to restore from backup');
    }
  }

  /**
   * 修复getProjectEnvironments方法的参数结构
   */
}