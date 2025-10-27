import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  like,
  or,
} from "drizzle-orm";
import { z } from "zod";
import { InjectDatabase } from "../../common/decorators/database.decorator";
import { Database } from "../../database/database.module";
import {
  insertMonitoringConfigSchema,
  MonitoringConfig,
  MonitorType,
  MonitorTypeEnum,
  monitoringConfigs,
  NewMonitoringConfig,
  selectMonitoringConfigSchema,
  UpdateMonitoringConfig,
  updateMonitoringConfigSchema,
} from "../../database/schemas/monitoring-configs.schema";

// 只保留必要的业务逻辑类型，其他都从schema导入
export interface MonitoringConfigStats {
  totalConfigs: number;
  activeConfigs: number;
  inactiveConfigs: number;
  configsByType: Record<MonitorType, number>;
  avgCheckInterval: number;
}

@Injectable()
export class MonitoringConfigsService {
  private readonly logger = new Logger(MonitoringConfigsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建监控配置
   */
  async createMonitoringConfig(
    data: NewMonitoringConfig
  ): Promise<MonitoringConfig> {
    try {
      // 验证输入数据
      const validatedData = insertMonitoringConfigSchema.parse(data);

      const [config] = await this.db
        .insert(monitoringConfigs)
        .values(validatedData)
        .returning();

      this.logger.log(
        `Monitoring config created: ${config.id} for project: ${config.projectId}`
      );
      return config;
    } catch (error) {
      this.logger.error(`Failed to create monitoring config: ${error}`);
      throw new BadRequestException(
        "Failed to create monitoring configuration"
      );
    }
  }

  /**
   * 根据ID获取监控配置
   */
  async getMonitoringConfigById(id: string): Promise<MonitoringConfig | null> {
    try {
      const [config] = await this.db
        .select()
        .from(monitoringConfigs)
        .where(eq(monitoringConfigs.id, id))
        .limit(1);

      return config || null;
    } catch (error) {
      this.logger.error(`Failed to get monitoring config by ID: ${error}`);
      return null;
    }
  }

  /**
   * 根据项目ID获取监控配置列表
   */
  async getMonitoringConfigsByProject(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MonitoringConfig[]> {
    try {
      const configs = await this.db
        .select()
        .from(monitoringConfigs)
        .where(eq(monitoringConfigs.projectId, projectId))
        .orderBy(desc(monitoringConfigs.createdAt))
        .limit(limit)
        .offset(offset);

      return configs;
    } catch (error) {
      this.logger.error(
        `Failed to get monitoring configs by project: ${error}`
      );
      throw new BadRequestException("Failed to get monitoring configurations");
    }
  }

  /**
   * 根据环境ID获取监控配置列表
   */
  async getMonitoringConfigsByEnvironment(
    environmentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MonitoringConfig[]> {
    try {
      const configs = await this.db
        .select()
        .from(monitoringConfigs)
        .where(eq(monitoringConfigs.environmentId, environmentId))
        .orderBy(desc(monitoringConfigs.createdAt))
        .limit(limit)
        .offset(offset);

      return configs;
    } catch (error) {
      this.logger.error(
        `Failed to get monitoring configs by environment: ${error}`
      );
      throw new BadRequestException("Failed to get monitoring configurations");
    }
  }

  /**
   * 根据监控类型获取配置列表
   */
  async getMonitoringConfigsByType(
    monitorType: z.infer<typeof MonitorTypeEnum>,
    limit: number = 50,
    offset: number = 0
  ): Promise<MonitoringConfig[]> {
    try {
      const configs = await this.db
        .select()
        .from(monitoringConfigs)
        .where(eq(monitoringConfigs.monitorType, monitorType))
        .orderBy(desc(monitoringConfigs.createdAt))
        .limit(limit)
        .offset(offset);

      return configs;
    } catch (error) {
      this.logger.error(`Failed to get monitoring configs by type: ${error}`);
      throw new BadRequestException("Failed to get monitoring configurations");
    }
  }

  /**
   * 获取活跃的监控配置
   */
  async getActiveMonitoringConfigs(
    projectId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<MonitoringConfig[]> {
    try {
      let whereCondition: ReturnType<typeof eq> | ReturnType<typeof and>;

      if (projectId) {
        whereCondition = and(
          eq(monitoringConfigs.isActive, true),
          eq(monitoringConfigs.projectId, projectId)
        );
      } else {
        whereCondition = eq(monitoringConfigs.isActive, true);
      }

      return await this.db
        .select()
        .from(monitoringConfigs)
        .where(whereCondition)
        .orderBy(desc(monitoringConfigs.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to get active monitoring configs: ${errorMessage}`
      );
      return [];
    }
  }

  /**
   * 搜索监控配置
   */
  async searchMonitoringConfigs(
    query: string,
    projectId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MonitoringConfig[]> {
    try {
      let whereCondition: ReturnType<typeof eq> | ReturnType<typeof and>;

      if (projectId) {
        whereCondition = and(
          like(monitoringConfigs.serviceName, `%${query}%`),
          eq(monitoringConfigs.projectId, projectId)
        );
      } else {
        whereCondition = like(monitoringConfigs.serviceName, `%${query}%`);
      }

      return await this.db
        .select()
        .from(monitoringConfigs)
        .where(whereCondition)
        .orderBy(desc(monitoringConfigs.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to search monitoring configs: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 更新监控配置
   */
  async updateMonitoringConfig(
    id: string,
    data: UpdateMonitoringConfig
  ): Promise<MonitoringConfig | null> {
    try {
      // 验证输入数据
      const validatedData = updateMonitoringConfigSchema.parse(data);

      const [updatedConfig] = await this.db
        .update(monitoringConfigs)
        .set(validatedData)
        .where(eq(monitoringConfigs.id, id))
        .returning();

      if (!updatedConfig) {
        throw new NotFoundException("Monitoring configuration not found");
      }

      this.logger.log(`Monitoring config updated: ${id}`);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Failed to update monitoring config: ${error}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        "Failed to update monitoring configuration"
      );
    }
  }

  /**
   * 启用/禁用监控配置
   */
  async toggleMonitoringConfig(
    id: string,
    isActive: boolean
  ): Promise<boolean> {
    try {
      const [updatedConfig] = await this.db
        .update(monitoringConfigs)
        .set({ isActive })
        .where(eq(monitoringConfigs.id, id))
        .returning();

      if (!updatedConfig) {
        this.logger.warn(`Monitoring config not found: ${id}`);
        return false;
      }

      this.logger.log(
        `Monitoring config ${isActive ? "enabled" : "disabled"}: ${id}`
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to toggle monitoring config: ${error}`);
      return false;
    }
  }

  /**
   * 删除监控配置
   */
  async deleteMonitoringConfig(id: string): Promise<boolean> {
    try {
      await this.db
        .delete(monitoringConfigs)
        .where(eq(monitoringConfigs.id, id));

      this.logger.log(`Monitoring config deleted: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete monitoring config: ${error}`);
      return false;
    }
  }

  /**
   * 批量删除监控配置
   */
  async batchDeleteMonitoringConfigs(ids: string[]): Promise<number> {
    try {
      if (ids.length === 0) return 0;

      await this.db
        .delete(monitoringConfigs)
        .where(inArray(monitoringConfigs.id, ids));

      this.logger.log(`Batch deleted ${ids.length} monitoring configs`);
      return ids.length;
    } catch (error) {
      this.logger.error(`Failed to batch delete monitoring configs: ${error}`);
      return 0;
    }
  }

  /**
   * 批量启用/禁用监控配置
   */
  async batchToggleMonitoringConfigs(
    ids: string[],
    isActive: boolean
  ): Promise<number> {
    try {
      if (ids.length === 0) return 0;

      await this.db
        .update(monitoringConfigs)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(inArray(monitoringConfigs.id, ids));

      this.logger.log(
        `Batch ${isActive ? "enabled" : "disabled"} ${
          ids.length
        } monitoring configs`
      );
      return ids.length;
    } catch (error) {
      this.logger.error(`Failed to batch toggle monitoring configs: ${error}`);
      return 0;
    }
  }

  /**
   * 获取监控配置统计信息
   */
  async getMonitoringConfigStats(
    projectId?: string
  ): Promise<MonitoringConfigStats> {
    try {
      const baseCondition = projectId
        ? eq(monitoringConfigs.projectId, projectId)
        : undefined;

      // 总配置数
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(monitoringConfigs)
        .where(baseCondition);

      // 活跃配置数
      const [activeResult] = await this.db
        .select({ count: count() })
        .from(monitoringConfigs)
        .where(and(baseCondition, eq(monitoringConfigs.isActive, true)));

      // 按类型统计
      const typeStats = await this.db
        .select({
          monitorType: monitoringConfigs.monitorType,
          count: count(),
        })
        .from(monitoringConfigs)
        .where(baseCondition)
        .groupBy(monitoringConfigs.monitorType);

      // 平均检查间隔
      const avgIntervalResult = await this.db
        .select()
        .from(monitoringConfigs)
        .where(and(baseCondition, eq(monitoringConfigs.isActive, true)));

      const avgCheckInterval =
        avgIntervalResult.length > 0
          ? avgIntervalResult.reduce(
              (sum, config) => sum + (config.checkInterval || 60),
              0
            ) / avgIntervalResult.length
          : 60;

      const configsByType: Record<MonitorType, number> = {
        uptime: 0,
        performance: 0,
        error_rate: 0,
        custom: 0,
      };

      typeStats.forEach((stat) => {
        configsByType[stat.monitorType] = stat.count;
      });

      return {
        totalConfigs: totalResult.count,
        activeConfigs: activeResult.count,
        inactiveConfigs: totalResult.count - activeResult.count,
        configsByType,
        avgCheckInterval: Math.round(avgCheckInterval),
      };
    } catch (error) {
      this.logger.error(`Failed to get monitoring config stats: ${error}`);
      throw new BadRequestException(
        "Failed to get monitoring configuration statistics"
      );
    }
  }

  /**
   * 复制监控配置
   */
  async duplicateMonitoringConfig(
    id: string,
    newServiceName?: string
  ): Promise<MonitoringConfig | null> {
    try {
      const originalConfig = await this.getMonitoringConfigById(id);
      if (!originalConfig) {
        throw new NotFoundException(
          "Original monitoring configuration not found"
        );
      }

      const { id: _, createdAt, updatedAt, ...configData } = originalConfig;

      const duplicatedConfig = await this.createMonitoringConfig({
        ...configData,
        serviceName:
          newServiceName || `${configData.serviceName || "service"}_copy`,
      });

      this.logger.log(
        `Monitoring config duplicated: ${id} -> ${duplicatedConfig.id}`
      );
      return duplicatedConfig;
    } catch (error) {
      this.logger.error(`Failed to duplicate monitoring config: ${error}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        "Failed to duplicate monitoring configuration"
      );
    }
  }

  /**
   * 获取监控配置数量
   */
  async getMonitoringConfigCount(
    projectId?: string,
    isActive?: boolean
  ): Promise<number> {
    try {
      const conditions = [];

      if (projectId) {
        conditions.push(eq(monitoringConfigs.projectId, projectId));
      }

      if (isActive !== undefined) {
        conditions.push(eq(monitoringConfigs.isActive, isActive));
      }

      const [result] = await this.db
        .select({ count: count() })
        .from(monitoringConfigs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to get monitoring config count: ${error}`);
      return 0;
    }
  }

  /**
   * 验证监控配置
   */
  async validateMonitoringConfig(config: Partial<MonitoringConfig>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // 基本验证
      if (!config.monitorType) {
        errors.push("Monitor type is required");
      }

      if (!config.projectId) {
        errors.push("Project ID is required");
      }

      // URL验证（如果是uptime监控）
      if (config.monitorType === "uptime" && !config.checkUrl) {
        errors.push("Check URL is required for uptime monitoring");
      }

      // 检查间隔验证
      if (
        config.checkInterval &&
        (config.checkInterval < 30 || config.checkInterval > 3600)
      ) {
        errors.push("Check interval must be between 30 and 3600 seconds");
      }

      // 超时验证
      if (config.timeout && (config.timeout < 5 || config.timeout > 300)) {
        errors.push("Timeout must be between 5 and 300 seconds");
      }

      // 重试次数验证
      if (
        config.retryCount &&
        (config.retryCount < 0 || config.retryCount > 10)
      ) {
        errors.push("Retry count must be between 0 and 10");
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error(`Failed to validate monitoring config: ${error}`);
      return {
        isValid: false,
        errors: ["Validation failed due to internal error"],
      };
    }
  }

  hello(): string {
    return "Hello from MonitoringConfigsService!";
  }
}
