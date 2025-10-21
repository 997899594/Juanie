import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface ConnectionPoolConfig {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  acquireTimeoutMillis: number;
}

export interface QueryStats {
  totalQueries: number;
  totalTransactions: number;
  averageQueryTime: number;
  slowQueries: number;
  errors: number;
}

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private db: PostgresJsDatabase<typeof schema>;
  private client: postgres.Sql;
  private readonly poolConfig: ConnectionPoolConfig;
  private queryStats: QueryStats = {
    totalQueries: 0,
    totalTransactions: 0,
    averageQueryTime: 0,
    slowQueries: 0,
    errors: 0,
  };
  private queryTimes: number[] = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.poolConfig = {
      max: this.configService.get<number>('DB_POOL_MAX') || 20,
      min: this.configService.get<number>('DB_POOL_MIN') || 2,
      idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT') || 30000,
      connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT') || 10000,
      acquireTimeoutMillis: this.configService.get<number>('DB_ACQUIRE_TIMEOUT') || 60000,
    };
  }

  async onModuleInit() {
    await this.initializeConnection();
    this.startHealthCheck();
    this.logger.log('DrizzleService initialized with optimized connection pool');
  }

  async onModuleDestroy() {
    await this.closeConnection();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.logger.log('DrizzleService destroyed');
  }

  private async initializeConnection() {
    try {
      const databaseUrl = this.configService.get<string>('DATABASE_URL');
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is not configured');
      }

      // 创建优化的PostgreSQL连接
      this.client = postgres(databaseUrl, {
        max: this.poolConfig.max,
        idle_timeout: this.poolConfig.idleTimeoutMillis / 1000, // postgres.js uses seconds
        connect_timeout: this.poolConfig.connectionTimeoutMillis / 1000,
        prepare: false, // 禁用预处理语句以提高性能
        transform: {
          undefined: null, // 将undefined转换为null
        },
        onnotice: (notice) => {
          this.logger.debug(`PostgreSQL notice: ${notice.message}`);
        },
        debug: this.configService.get<string>('NODE_ENV') === 'development',
      });

      // 创建Drizzle实例
      this.db = drizzle(this.client, {
        schema,
        logger: this.configService.get<string>('NODE_ENV') === 'development',
      });

      // 测试连接
      await this.testConnection();
      this.logger.log('Database connection established successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      await this.client`SELECT 1 as test`;
    } catch (error) {
      throw new Error(`Database connection test failed: ${error}`);
    }
  }

  private startHealthCheck(): void {
    const interval = this.configService.get<number>('DB_HEALTH_CHECK_INTERVAL') || 30000;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const start = Date.now();
        await this.testConnection();
        const duration = Date.now() - start;
        
        if (duration > 1000) {
          this.logger.warn(`Database health check slow: ${duration}ms`);
        }
      } catch (error) {
        this.logger.error('Database health check failed:', error);
      }
    }, interval);
  }

  /**
   * 获取数据库实例
   */
  getDb(): PostgresJsDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('Database connection not initialized');
    }
    return this.db;
  }

  /**
   * 执行事务
   */
  async transaction<T>(
    callback: (tx: PostgresJsDatabase<typeof schema>) => Promise<T>,
    options?: {
      isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
      timeout?: number;
    }
  ): Promise<T> {
    const startTime = Date.now();
    this.queryStats.totalTransactions++;

    try {
      const result = await this.db.transaction(async (tx) => {
        // 设置事务隔离级别
        if (options?.isolationLevel) {
          await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel.toUpperCase()}` as any);
        }

        // 设置事务超时
        if (options?.timeout) {
          await tx.execute(`SET LOCAL statement_timeout = ${options.timeout}` as any);
        }

        return await callback(tx);
      });

      const duration = Date.now() - startTime;
      this.updateQueryStats(duration);
      
      return result;
    } catch (error) {
      this.queryStats.errors++;
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * 执行查询并记录统计信息
   */
  async query<T>(queryFn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.queryStats.totalQueries++;

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      this.updateQueryStats(duration);
      
      return result;
    } catch (error) {
      this.queryStats.errors++;
      this.logger.error('Query failed:', error);
      throw error;
    }
  }

  private updateQueryStats(duration: number): void {
    this.queryTimes.push(duration);
    
    // 保持最近1000次查询的统计
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }

    // 更新平均查询时间
    this.queryStats.averageQueryTime = 
      this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;

    // 记录慢查询（超过1秒）
    if (duration > 1000) {
      this.queryStats.slowQueries++;
      this.logger.warn(`Slow query detected: ${duration}ms`);
    }
  }

  /**
   * 获取连接池统计信息
   */
  getStats(): QueryStats & { poolConfig: ConnectionPoolConfig } {
    return {
      ...this.queryStats,
      poolConfig: this.poolConfig,
    };
  }

  /**
   * 获取连接健康状态
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    responseTime: number;
    timestamp: Date;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      await this.testConnection();
      return {
        healthy: true,
        responseTime: Date.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - start,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 清理查询统计
   */
  clearStats(): void {
    this.queryStats = {
      totalQueries: 0,
      totalTransactions: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      errors: 0,
    };
    this.queryTimes = [];
    this.logger.log('Query statistics cleared');
  }

  private async closeConnection(): Promise<void> {
    try {
      if (this.client) {
        await this.client.end();
        this.logger.log('Database connection closed');
      }
    } catch (error) {
      this.logger.error('Error closing database connection:', error);
    }
  }
}