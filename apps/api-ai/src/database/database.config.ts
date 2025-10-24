/**
 * 🚀 Juanie AI - 前沿数据库配置
 * 支持PostgreSQL、向量数据库、事件存储和分布式架构
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { z } from 'zod';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  getEnvVar, 
  getBooleanEnvVar, 
  getNumberEnvVar,
  CONSTANTS
} from '../core';
import type { DeepPartial } from '../core/types';

// ============================================================================
// 数据库配置Schema
// ============================================================================

export const DatabaseConfigSchema = z.object({
  // 主数据库配置
  primary: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    ssl: z.boolean().default(true),
    schema: z.string().default('public'),
  }),
  
  // 读副本配置
  replicas: z.array(z.object({
    host: z.string(),
    port: z.number().default(5432),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    ssl: z.boolean().default(true),
    weight: z.number().default(1),
  })).optional(),
  
  // 连接池配置
  pool: z.object({
    min: z.number().default(5),
    max: z.number().default(20),
    idleTimeoutMillis: z.number().default(30000),
    connectionTimeoutMillis: z.number().default(10000),
    maxLifetimeSeconds: z.number().default(3600),
    statementTimeout: z.number().default(30000),
    queryTimeout: z.number().default(60000),
  }),
  
  // 向量数据库配置
  vector: z.object({
    provider: z.enum(['qdrant', 'pinecone', 'weaviate', 'pgvector']).default('pgvector'),
    host: z.string().optional(),
    port: z.number().optional(),
    apiKey: z.string().optional(),
    collection: z.string().default('embeddings'),
    dimensions: z.number().default(1536),
    metric: z.enum(['cosine', 'euclidean', 'dot']).default('cosine'),
  }),
  
  // 事件存储配置
  eventStore: z.object({
    enabled: z.boolean().default(true),
    schema: z.string().default('events'),
    snapshotFrequency: z.number().default(100),
    retentionDays: z.number().default(365),
    compression: z.boolean().default(true),
    encryption: z.boolean().default(true),
  }),
  
  // 缓存配置
  cache: z.object({
    redis: z.object({
      host: z.string().default('localhost'),
      port: z.number().default(6379),
      password: z.string().optional(),
      db: z.number().default(0),
      keyPrefix: z.string().default('juanie:'),
      ttl: z.number().default(3600),
    }),
    memory: z.object({
      maxSize: z.number().default(100 * 1024 * 1024), // 100MB
      ttl: z.number().default(300), // 5分钟
    }),
  }),
  
  // 监控配置
  monitoring: z.object({
    enabled: z.boolean().default(true),
    slowQueryThreshold: z.number().default(1000), // 1秒
    logQueries: z.boolean().default(false),
    metricsInterval: z.number().default(30000), // 30秒
  }),
  
  // 迁移配置
  migrations: z.object({
    enabled: z.boolean().default(true),
    directory: z.string().default('./src/database/migrations'),
    tableName: z.string().default('migrations'),
    lockTimeout: z.number().default(60000), // 1分钟
  }),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// ============================================================================
// 数据库连接管理器
// ============================================================================

@Injectable()
export class DatabaseManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseManager.name);
  private primaryConnection: postgres.Sql | null = null;
  private replicaConnections: postgres.Sql[] = [];
  private primaryDb: ReturnType<typeof drizzle> | null = null;
  private replicaDbs: ReturnType<typeof drizzle>[] = [];
  private config: DatabaseConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  // 连接统计
  private stats = {
    totalQueries: 0,
    slowQueries: 0,
    errors: 0,
    connections: {
      active: 0,
      idle: 0,
      waiting: 0,
    },
    lastHealthCheck: new Date(),
  };

  constructor(private configService: ConfigService) {
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  /**
   * 加载数据库配置
   */
  private loadConfig(): DatabaseConfig {
    const config: DeepPartial<DatabaseConfig> = {
      primary: {
        host: getEnvVar('DB_HOST', 'localhost'),
        port: getNumberEnvVar('DB_PORT', 5432),
        database: getEnvVar('DB_NAME'),
        username: getEnvVar('DB_USER'),
        password: getEnvVar('DB_PASSWORD'),
        ssl: getBooleanEnvVar('DB_SSL', true),
        schema: getEnvVar('DB_SCHEMA', 'public'),
      },
      pool: {
        min: getNumberEnvVar('DB_POOL_MIN', 5),
        max: getNumberEnvVar('DB_POOL_MAX', 20),
        idleTimeoutMillis: getNumberEnvVar('DB_IDLE_TIMEOUT', 30000),
        connectionTimeoutMillis: getNumberEnvVar('DB_CONNECTION_TIMEOUT', 10000),
        maxLifetimeSeconds: getNumberEnvVar('DB_MAX_LIFETIME', 3600),
        statementTimeout: getNumberEnvVar('DB_STATEMENT_TIMEOUT', 30000),
        queryTimeout: getNumberEnvVar('DB_QUERY_TIMEOUT', 60000),
      },
      vector: {
        provider: getEnvVar('VECTOR_PROVIDER', 'pgvector') as any,
        host: getEnvVar('VECTOR_HOST', undefined),
        port: getNumberEnvVar('VECTOR_PORT', undefined),
        apiKey: getEnvVar('VECTOR_API_KEY', undefined),
        collection: getEnvVar('VECTOR_COLLECTION', 'embeddings'),
        dimensions: getNumberEnvVar('VECTOR_DIMENSIONS', 1536),
        metric: getEnvVar('VECTOR_METRIC', 'cosine') as any,
      },
      eventStore: {
        enabled: getBooleanEnvVar('EVENT_STORE_ENABLED', true),
        schema: getEnvVar('EVENT_STORE_SCHEMA', 'events'),
        snapshotFrequency: getNumberEnvVar('EVENT_STORE_SNAPSHOT_FREQ', 100),
        retentionDays: getNumberEnvVar('EVENT_STORE_RETENTION_DAYS', 365),
        compression: getBooleanEnvVar('EVENT_STORE_COMPRESSION', true),
        encryption: getBooleanEnvVar('EVENT_STORE_ENCRYPTION', true),
      },
      cache: {
        redis: {
          host: getEnvVar('REDIS_HOST', 'localhost'),
          port: getNumberEnvVar('REDIS_PORT', 6379),
          password: getEnvVar('REDIS_PASSWORD', undefined),
          db: getNumberEnvVar('REDIS_DB', 0),
          keyPrefix: getEnvVar('REDIS_KEY_PREFIX', 'juanie:'),
          ttl: getNumberEnvVar('REDIS_TTL', 3600),
        },
      },
      monitoring: {
        enabled: getBooleanEnvVar('DB_MONITORING_ENABLED', true),
        slowQueryThreshold: getNumberEnvVar('DB_SLOW_QUERY_THRESHOLD', 1000),
        logQueries: getBooleanEnvVar('DB_LOG_QUERIES', false),
        metricsInterval: getNumberEnvVar('DB_METRICS_INTERVAL', 30000),
      },
    };

    return DatabaseConfigSchema.parse(config);
  }

  /**
   * 初始化数据库连接
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.log('Initializing database connections...');
      
      // 创建主数据库连接
      await this.createPrimaryConnection();
      
      // 创建读副本连接
      await this.createReplicaConnections();
      
      // 运行迁移
      if (this.config.migrations.enabled) {
        await this.runMigrations();
      }
      
      // 启动健康检查
      this.startHealthCheck();
      
      // 启动指标收集
      if (this.config.monitoring.enabled) {
        this.startMetricsCollection();
      }
      
      this.logger.log('Database connections initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database connections', error);
      throw error;
    }
  }

  /**
   * 创建主数据库连接
   */
  private async createPrimaryConnection(): Promise<void> {
    const { primary, pool } = this.config;
    
    const connectionString = `postgresql://${primary.username}:${primary.password}@${primary.host}:${primary.port}/${primary.database}`;
    
    this.primaryConnection = postgres(connectionString, {
      max: pool.max,
      idle_timeout: pool.idleTimeoutMillis / 1000,
      connect_timeout: pool.connectionTimeoutMillis / 1000,
      max_lifetime: pool.maxLifetimeSeconds,
      ssl: primary.ssl ? 'require' : false,
      transform: {
        undefined: null,
      },
      onnotice: (notice) => {
        this.logger.debug(`Database notice: ${notice.message}`);
      },
      debug: this.config.monitoring.logQueries,
    });

    this.primaryDb = drizzle(this.primaryConnection, {
      logger: this.config.monitoring.logQueries,
    });

    // 测试连接
    await this.primaryConnection`SELECT 1`;
    this.logger.log('Primary database connection established');
  }

  /**
   * 创建读副本连接
   */
  private async createReplicaConnections(): Promise<void> {
    if (!this.config.replicas?.length) {
      return;
    }

    for (const replica of this.config.replicas) {
      try {
        const connectionString = `postgresql://${replica.username}:${replica.password}@${replica.host}:${replica.port}/${replica.database}`;
        
        const connection = postgres(connectionString, {
          max: Math.ceil(this.config.pool.max / this.config.replicas.length),
          idle_timeout: this.config.pool.idleTimeoutMillis / 1000,
          connect_timeout: this.config.pool.connectionTimeoutMillis / 1000,
          ssl: replica.ssl ? 'require' : false,
        });

        const db = drizzle(connection);
        
        // 测试连接
        await connection`SELECT 1`;
        
        this.replicaConnections.push(connection);
        this.replicaDbs.push(db);
        
        this.logger.log(`Read replica connection established: ${replica.host}:${replica.port}`);
      } catch (error) {
        this.logger.warn(`Failed to connect to replica ${replica.host}:${replica.port}`, error);
      }
    }
  }

  /**
   * 运行数据库迁移
   */
  private async runMigrations(): Promise<void> {
    if (!this.primaryDb) {
      throw new Error('Primary database connection not established');
    }

    try {
      this.logger.log('Running database migrations...');
      
      await migrate(this.primaryDb, {
        migrationsFolder: this.config.migrations.directory,
        migrationsTable: this.config.migrations.tableName,
      });
      
      this.logger.log('Database migrations completed successfully');
    } catch (error) {
      this.logger.error('Database migration failed', error);
      throw error;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed', error);
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 检查主数据库
      if (this.primaryConnection) {
        await this.primaryConnection`SELECT 1`;
      }
      
      // 检查读副本
      for (const replica of this.replicaConnections) {
        await replica`SELECT 1`;
      }
      
      this.stats.lastHealthCheck = new Date();
      
      const duration = Date.now() - startTime;
      this.logger.debug(`Health check completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * 收集数据库指标
   */
  private collectMetrics(): void {
    try {
      // 更新连接统计
      if (this.primaryConnection) {
        // 这里可以添加更详细的连接池统计
        this.logger.debug('Database metrics collected', this.stats);
      }
    } catch (error) {
      this.logger.error('Failed to collect database metrics', error);
    }
  }

  /**
   * 获取主数据库实例（写操作）
   */
  getPrimaryDb(): ReturnType<typeof drizzle> {
    if (!this.primaryDb) {
      throw new Error('Primary database not initialized');
    }
    return this.primaryDb;
  }

  /**
   * 获取读数据库实例（读操作）
   */
  getReadDb(): ReturnType<typeof drizzle> {
    // 如果有读副本，使用负载均衡选择
    if (this.replicaDbs.length > 0) {
      const index = Math.floor(Math.random() * this.replicaDbs.length);
      return this.replicaDbs[index];
    }
    
    // 否则使用主数据库
    return this.getPrimaryDb();
  }

  /**
   * 执行事务
   */
  async transaction<T>(
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    const db = this.getPrimaryDb();
    return await db.transaction(callback);
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    return {
      ...this.stats,
      config: {
        primaryHost: this.config.primary.host,
        replicaCount: this.replicaConnections.length,
        poolSize: this.config.pool.max,
      },
    };
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.logger.log('Cleaning up database connections...');
    
    // 清理定时器
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // 关闭连接
    try {
      if (this.primaryConnection) {
        await this.primaryConnection.end();
      }
      
      for (const replica of this.replicaConnections) {
        await replica.end();
      }
      
      this.logger.log('Database connections closed successfully');
    } catch (error) {
      this.logger.error('Error closing database connections', error);
    }
  }
}

// ============================================================================
// 向量数据库管理器
// ============================================================================

@Injectable()
export class VectorDatabaseManager implements OnModuleInit {
  private readonly logger = new Logger(VectorDatabaseManager.name);
  private client: any = null;
  private config: DatabaseConfig['vector'];

  constructor(private configService: ConfigService) {
    this.config = DatabaseConfigSchema.parse({
      vector: {
        provider: getEnvVar('VECTOR_PROVIDER', 'pgvector'),
        host: getEnvVar('VECTOR_HOST', undefined),
        port: getNumberEnvVar('VECTOR_PORT', undefined),
        apiKey: getEnvVar('VECTOR_API_KEY', undefined),
        collection: getEnvVar('VECTOR_COLLECTION', 'embeddings'),
        dimensions: getNumberEnvVar('VECTOR_DIMENSIONS', 1536),
        metric: getEnvVar('VECTOR_METRIC', 'cosine'),
      }
    }).vector;
  }

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.logger.log(`Initializing ${this.config.provider} vector database...`);
      
      switch (this.config.provider) {
        case 'pgvector':
          await this.initializePgVector();
          break;
        case 'qdrant':
          await this.initializeQdrant();
          break;
        case 'pinecone':
          await this.initializePinecone();
          break;
        case 'weaviate':
          await this.initializeWeaviate();
          break;
        default:
          throw new Error(`Unsupported vector database provider: ${this.config.provider}`);
      }
      
      this.logger.log('Vector database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize vector database', error);
      throw error;
    }
  }

  private async initializePgVector(): Promise<void> {
    // pgvector 使用主数据库连接，无需额外初始化
    this.logger.log('Using pgvector extension in PostgreSQL');
  }

  private async initializeQdrant(): Promise<void> {
    // 这里可以集成 Qdrant 客户端
    this.logger.log('Qdrant client would be initialized here');
  }

  private async initializePinecone(): Promise<void> {
    // 这里可以集成 Pinecone 客户端
    this.logger.log('Pinecone client would be initialized here');
  }

  private async initializeWeaviate(): Promise<void> {
    // 这里可以集成 Weaviate 客户端
    this.logger.log('Weaviate client would be initialized here');
  }

  /**
   * 搜索相似向量
   */
  async searchSimilar(
    vector: number[],
    options: {
      limit?: number;
      threshold?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<Array<{ id: string; score: number; metadata?: any }>> {
    const { limit = 10, threshold = 0.7, filter } = options;
    
    // 这里实现具体的向量搜索逻辑
    this.logger.debug(`Searching for similar vectors with limit: ${limit}, threshold: ${threshold}`);
    
    // 模拟返回结果
    return [];
  }

  /**
   * 插入向量
   */
  async insertVector(
    id: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<void> {
    this.logger.debug(`Inserting vector with id: ${id}`);
    // 实现向量插入逻辑
  }

  /**
   * 删除向量
   */
  async deleteVector(id: string): Promise<void> {
    this.logger.debug(`Deleting vector with id: ${id}`);
    // 实现向量删除逻辑
  }

  /**
   * 批量操作
   */
  async batchOperation(
    operations: Array<{
      type: 'insert' | 'update' | 'delete';
      id: string;
      vector?: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    this.logger.debug(`Executing batch operation with ${operations.length} operations`);
    // 实现批量操作逻辑
  }
}

// ============================================================================
// 事件存储管理器
// ============================================================================

@Injectable()
export class EventStoreManager implements OnModuleInit {
  private readonly logger = new Logger(EventStoreManager.name);
  private config: DatabaseConfig['eventStore'];

  constructor(
    private databaseManager: DatabaseManager,
    private configService: ConfigService
  ) {
    this.config = DatabaseConfigSchema.parse({
      eventStore: {
        enabled: getBooleanEnvVar('EVENT_STORE_ENABLED', true),
        schema: getEnvVar('EVENT_STORE_SCHEMA', 'events'),
        snapshotFrequency: getNumberEnvVar('EVENT_STORE_SNAPSHOT_FREQ', 100),
        retentionDays: getNumberEnvVar('EVENT_STORE_RETENTION_DAYS', 365),
        compression: getBooleanEnvVar('EVENT_STORE_COMPRESSION', true),
        encryption: getBooleanEnvVar('EVENT_STORE_ENCRYPTION', true),
      }
    }).eventStore;
  }

  async onModuleInit() {
    if (this.config.enabled) {
      await this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {
      this.logger.log('Initializing event store...');
      
      // 创建事件存储schema和表
      await this.createEventStoreTables();
      
      // 启动快照和清理任务
      this.startMaintenanceTasks();
      
      this.logger.log('Event store initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize event store', error);
      throw error;
    }
  }

  private async createEventStoreTables(): Promise<void> {
    const db = this.databaseManager.getPrimaryDb();
    
    // 这里可以创建事件存储相关的表结构
    this.logger.log(`Creating event store tables in schema: ${this.config.schema}`);
  }

  private startMaintenanceTasks(): void {
    // 启动快照任务
    setInterval(() => {
      this.createSnapshots();
    }, 24 * 60 * 60 * 1000); // 每天执行一次
    
    // 启动清理任务
    setInterval(() => {
      this.cleanupOldEvents();
    }, 7 * 24 * 60 * 60 * 1000); // 每周执行一次
  }

  private async createSnapshots(): Promise<void> {
    this.logger.debug('Creating event store snapshots...');
    // 实现快照创建逻辑
  }

  private async cleanupOldEvents(): Promise<void> {
    this.logger.debug('Cleaning up old events...');
    // 实现事件清理逻辑
  }

  /**
   * 存储事件
   */
  async storeEvent(event: {
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    eventData: any;
    metadata?: any;
  }): Promise<void> {
    this.logger.debug(`Storing event: ${event.eventType} for aggregate: ${event.aggregateId}`);
    // 实现事件存储逻辑
  }

  /**
   * 获取事件流
   */
  async getEventStream(
    aggregateId: string,
    fromVersion?: number
  ): Promise<Array<any>> {
    this.logger.debug(`Getting event stream for aggregate: ${aggregateId}`);
    // 实现事件流获取逻辑
    return [];
  }
}

// ============================================================================
// 数据库模块导出
// ============================================================================

export const DatabaseProviders = [
  DatabaseManager,
  VectorDatabaseManager,
  EventStoreManager,
];