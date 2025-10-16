import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { 
  DrizzleDatabase, 
  DrizzleConnectionInfo, 
  TransactionConfig, 
  TransactionContext,
  HealthCheckResult,
  QueryStats 
} from './interfaces/drizzle-connection.interface.js'
import type { DrizzleModuleOptions } from './interfaces/drizzle-options.interface.js'
import { 
  createDatabaseConnection, 
  testConnection, 
  closeConnection, 
  getConnectionStats,
  formatConnectionString 
} from './utils/connection.utils.js'
import { runMigrations, checkMigrationStatus, type MigrationResult } from './utils/migration.utils.js'
import { ConnectionStatus, DEFAULT_CONNECTION_NAME } from './constants/drizzle.constants.js'
import { randomUUID } from 'crypto'

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name)
  private readonly connections = new Map<string, DrizzleConnectionInfo>()
  private readonly activeTransactions = new Map<string, TransactionContext>()
  private readonly queryStats: QueryStats[] = []
  private healthCheckInterval?: NodeJS.Timeout

  async onModuleInit() {
    this.logger.log('Drizzle service initialized')
  }

  async onModuleDestroy() {
    await this.closeAllConnections()
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    this.logger.log('Drizzle service destroyed')
  }

  /**
   * 创建数据库连接
   */
  async createConnection(
    name: string,
    options: DrizzleModuleOptions
  ): Promise<DrizzleConnectionInfo> {
    try {
      this.logger.log(`Creating database connection: ${name}`)
      
      const { database, rawConnection } = await createDatabaseConnection(
        options.connection,
        options.logging
      )

      const connectionInfo: DrizzleConnectionInfo = {
        name,
        status: ConnectionStatus.CONNECTED,
        database,
        rawConnection,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        config: options,
        stats: {
          totalQueries: 0,
          totalTransactions: 0,
          activeQueries: 0,
          activeTransactions: 0,
          errors: 0,
        },
      }

      // 测试连接
      const isHealthy = await testConnection(database)
      if (!isHealthy) {
        connectionInfo.status = ConnectionStatus.ERROR
        throw new Error(`Failed to establish connection: ${name}`)
      }

      this.connections.set(name, connectionInfo)

      // 运行自动迁移
      if (options.autoMigrate && options.migrationsFolder) {
        await this.runAutoMigration(name, options)
      }

      // 启动健康检查
      if (options.healthCheck?.enabled) {
        this.startHealthCheck(name, options.healthCheck)
      }

      this.logger.log(`Database connection created successfully: ${name}`)
      return connectionInfo
    } catch (error) {
      this.logger.error(
        `Failed to create connection ${name}:`,
        error instanceof Error ? error.message : String(error),
      )
      throw error
    }
  }

  /**
   * 获取数据库连接
   */
  getConnection(name: string = DEFAULT_CONNECTION_NAME): DrizzleDatabase {
    const connection = this.connections.get(name)
    if (!connection) {
      throw new Error(`Database connection not found: ${name}`)
    }

    if (connection.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Database connection is not available: ${name}`)
    }

    // 更新最后活跃时间
    connection.lastActiveAt = new Date()
    return connection.database
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo(name: string = DEFAULT_CONNECTION_NAME): DrizzleConnectionInfo | undefined {
    return this.connections.get(name)
  }

  /**
   * 获取所有连接信息
   */
  getAllConnections(): DrizzleConnectionInfo[] {
    return Array.from(this.connections.values())
  }

  /**
   * 开始事务
   */
  async beginTransaction(
    config: TransactionConfig = {},
    connectionName: string = DEFAULT_CONNECTION_NAME
  ): Promise<TransactionContext> {
    const connection = this.getConnection(connectionName)
    const transactionId = randomUUID()

    try {
      // 这里需要根据具体的 Drizzle 事务 API 来实现
      // 目前 Drizzle 的事务 API 可能因版本而异
      const tx = connection as any // 临时类型转换

      const transactionContext: TransactionContext = {
        id: transactionId,
        tx,
        config,
        startedAt: new Date(),
        committed: false,
        rolledBack: false,
        stats: {
          queries: 0,
          duration: 0,
        },
      }

      this.activeTransactions.set(transactionId, transactionContext)

      // 更新连接统计
      const connectionInfo = this.connections.get(connectionName)
      if (connectionInfo) {
        connectionInfo.stats.totalTransactions++
        connectionInfo.stats.activeTransactions++
      }

      this.logger.debug(`Transaction started: ${transactionId}`)
      return transactionContext
    } catch (error) {
      this.logger.error(`Failed to start transaction: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 提交事务
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`)
    }

    try {
      // 实际的提交逻辑需要根据 Drizzle API 实现
      // await transaction.tx.commit()

      transaction.committed = true
      transaction.stats.duration = Date.now() - transaction.startedAt.getTime()
      
      this.activeTransactions.delete(transactionId)
      this.logger.debug(`Transaction committed: ${transactionId}`)
    } catch (error) {
      this.logger.error(`Failed to commit transaction ${transactionId}:`, error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * 回滚事务
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`)
    }

    try {
      // 实际的回滚逻辑需要根据 Drizzle API 实现
      // await transaction.tx.rollback()

      transaction.rolledBack = true
      transaction.stats.duration = Date.now() - transaction.startedAt.getTime()
      
      this.activeTransactions.delete(transactionId)
      this.logger.debug(`Transaction rolled back: ${transactionId}`)
    } catch (error) {
      this.logger.error(`Failed to rollback transaction ${transactionId}:`, error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * 运行迁移
   */
  async migrate(
    connectionName: string = DEFAULT_CONNECTION_NAME,
    migrationsFolder?: string
  ): Promise<MigrationResult> {
    const connectionInfo = this.connections.get(connectionName)
    if (!connectionInfo) {
      throw new Error(`Connection not found: ${connectionName}`)
    }

    const folder = migrationsFolder || connectionInfo.config.migrationsFolder
    if (!folder) {
      throw new Error('Migrations folder not specified')
    }

    return runMigrations(connectionInfo.database, {
      migrationsFolder: folder,
      databaseType: connectionInfo.config.connection.type,
    })
  }

  /**
   * 检查迁移状态
   */
  async getMigrationStatus(
    connectionName: string = DEFAULT_CONNECTION_NAME,
    migrationsFolder?: string
  ) {
    const connectionInfo = this.connections.get(connectionName)
    if (!connectionInfo) {
      throw new Error(`Connection not found: ${connectionName}`)
    }

    const folder = migrationsFolder || connectionInfo.config.migrationsFolder
    if (!folder) {
      throw new Error('Migrations folder not specified')
    }

    return checkMigrationStatus(connectionInfo.database, folder)
  }

  /**
   * 健康检查
   */
  async healthCheck(connectionName?: string): Promise<HealthCheckResult[]> {
    const connectionsToCheck = connectionName 
      ? [this.connections.get(connectionName)].filter(Boolean)
      : Array.from(this.connections.values())

    const results: HealthCheckResult[] = []

    for (const connection of connectionsToCheck) {
      if (!connection) continue
      
      const startTime = Date.now()
      
      try {
        const isHealthy = await testConnection(connection.database)
        
        results.push({
          name: connection.name,
          healthy: isHealthy,
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          details: getConnectionStats(connection.rawConnection, connection.config.connection.type),
        })
      } catch (error) {
        results.push({
          name: connection?.name || 'unknown',
          healthy: false,
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const connections = Array.from(this.connections.values())
    
    return {
      connections: connections.length,
      activeConnections: connections.filter(c => c.status === ConnectionStatus.CONNECTED).length,
      totalQueries: connections.reduce((sum, c) => sum + c.stats.totalQueries, 0),
      totalTransactions: connections.reduce((sum, c) => sum + c.stats.totalTransactions, 0),
      activeTransactions: this.activeTransactions.size,
      errors: connections.reduce((sum, c) => sum + c.stats.errors, 0),
      queryStats: this.queryStats.slice(-100), // 最近 100 条查询统计
    }
  }

  /**
   * 关闭连接
   */
  async closeConnection(name: string): Promise<void> {
    const connection = this.connections.get(name)
    if (!connection) {
      return
    }

    try {
      await closeConnection(connection.rawConnection, connection.config.connection.type)
      connection.status = ConnectionStatus.DISCONNECTED
      this.connections.delete(name)
      this.logger.log(`Connection closed: ${name}`)
    } catch (error) {
      this.logger.error(`Failed to close connection ${name}:`, error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 关闭所有连接
   */
  private async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.keys()).map(name => 
      this.closeConnection(name)
    )
    
    await Promise.all(closePromises)
  }

  /**
   * 运行自动迁移
   */
  private async runAutoMigration(name: string, options: DrizzleModuleOptions): Promise<void> {
    try {
      this.logger.log(`Running auto migration for connection: ${name}`)
      const result = await this.migrate(name, options.migrationsFolder)
      
      if (result.success) {
        this.logger.log(`Auto migration completed: ${result.migrationsExecuted} migrations executed`)
      } else {
        this.logger.error(`Auto migration failed: ${result.error}`)
      }
    } catch (error) {
      this.logger.error(`Auto migration error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(name: string, config: { interval?: number; timeout?: number }): void {
    const interval = config.interval || 30000 // 默认 30 秒
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const results = await this.healthCheck(name)
        const result = results[0]
        
        if (result && !result.healthy) {
          this.logger.warn(`Health check failed for connection ${name}: ${result.error}`)
        }
      } catch (error) {
        this.logger.error(`Health check error for connection ${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }, interval)
  }
}