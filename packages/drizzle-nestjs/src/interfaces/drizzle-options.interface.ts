import type { Logger } from 'drizzle-orm'
import type { DatabaseType, TransactionIsolationLevel } from '../constants/drizzle.constants.js'

/**
 * 数据库连接配置
 */
export interface DatabaseConnectionConfig {
  /**
   * 数据库类型
   */
  type: DatabaseType
  
  /**
   * 连接字符串或连接配置
   */
  connection: string | Record<string, any>
  
  /**
   * 数据库 schema 定义
   */
  schema?: Record<string, any>
  
  /**
   * 连接池配置
   */
  pool?: {
    min?: number
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
  }
  
  /**
   * SSL 配置
   */
  ssl?: boolean | Record<string, any>
  
  /**
   * 自定义驱动配置
   */
  driverOptions?: Record<string, any>
}

/**
 * Drizzle 模块配置选项
 */
export interface DrizzleModuleOptions {
  /**
   * 连接名称
   */
  name?: string
  
  /**
   * 数据库连接配置
   */
  connection: DatabaseConnectionConfig
  
  /**
   * 是否启用日志
   */
  logging?: boolean | Logger
  
  /**
   * 是否启用开发模式
   */
  development?: boolean
  
  /**
   * 自动运行迁移
   */
  autoMigrate?: boolean
  
  /**
   * 迁移文件路径
   */
  migrationsFolder?: string
  
  /**
   * 默认事务隔离级别
   */
  defaultIsolationLevel?: TransactionIsolationLevel
  
  /**
   * 连接重试配置
   */
  retry?: {
    attempts?: number
    delay?: number
    backoff?: 'exponential' | 'linear'
  }
  
  /**
   * 健康检查配置
   */
  healthCheck?: {
    enabled?: boolean
    interval?: number
    timeout?: number
  }
  
  /**
   * 自定义元数据
   */
  meta?: Record<string, any>
}

/**
 * Drizzle 异步模块配置选项
 */
export interface DrizzleModuleAsyncOptions {
  /**
   * 连接名称
   */
  name?: string
  
  /**
   * 导入的模块
   */
  imports?: any[]
  
  /**
   * 注入的依赖
   */
  inject?: any[]
  
  /**
   * 使用工厂函数创建配置
   */
  useFactory?: (...args: any[]) => DrizzleModuleOptions | Promise<DrizzleModuleOptions>
  
  /**
   * 使用类创建配置
   */
  useClass?: new (...args: any[]) => DrizzleOptionsFactory
  
  /**
   * 使用现有的配置提供者
   */
  useExisting?: any
  
  /**
   * 是否为全局模块
   */
  isGlobal?: boolean
}

/**
 * Drizzle 配置工厂接口
 */
export interface DrizzleOptionsFactory {
  createDrizzleOptions(): DrizzleModuleOptions | Promise<DrizzleModuleOptions>
}

/**
 * 多连接配置
 */
export interface DrizzleMultiConnectionOptions {
  /**
   * 默认连接名称
   */
  defaultConnection?: string
  
  /**
   * 连接配置列表
   */
  connections: Array<DrizzleModuleOptions & { name: string }>
  
  /**
   * 是否为全局模块
   */
  isGlobal?: boolean
}