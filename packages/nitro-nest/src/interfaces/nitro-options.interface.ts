import type { CorsOptions } from 'h3'
import type { CacheStrategy, ResponseType } from '../constants/nitro.constants.js'

/**
 * CORS 配置
 */
export interface NitroCorsConfig {
  /**
   * 是否启用 CORS
   */
  enabled?: boolean
  
  /**
   * 允许的源
   */
  origin?: string | string[] | boolean | ((origin: string) => boolean)
  
  /**
   * 允许的 HTTP 方法
   */
  methods?: string[]
  
  /**
   * 允许的请求头
   */
  allowedHeaders?: string[]
  
  /**
   * 暴露的响应头
   */
  exposedHeaders?: string[]
  
  /**
   * 是否允许凭证
   */
  credentials?: boolean
  
  /**
   * 预检请求缓存时间
   */
  maxAge?: number
}

/**
 * 速率限制配置
 */
export interface NitroRateLimitConfig {
  /**
   * 是否启用速率限制
   */
  enabled?: boolean
  
  /**
   * 时间窗口（毫秒）
   */
  windowMs?: number
  
  /**
   * 最大请求数
   */
  max?: number
  
  /**
   * 错误消息
   */
  message?: string
  
  /**
   * 自定义键生成器
   */
  keyGenerator?: (event: any) => string
  
  /**
   * 跳过条件
   */
  skip?: (event: any) => boolean
}

/**
 * 压缩配置
 */
export interface NitroCompressionConfig {
  /**
   * 是否启用压缩
   */
  enabled?: boolean
  
  /**
   * 压缩阈值（字节）
   */
  threshold?: number
  
  /**
   * 压缩级别
   */
  level?: number
  
  /**
   * 压缩算法
   */
  algorithm?: 'gzip' | 'deflate' | 'br'
}

/**
 * 安全配置
 */
export interface NitroSecurityConfig {
  /**
   * 是否启用 Helmet
   */
  helmet?: boolean
  
  /**
   * 是否启用 CSRF 保护
   */
  csrf?: boolean
  
  /**
   * 内容安全策略
   */
  csp?: Record<string, string[]>
  
  /**
   * HSTS 配置
   */
  hsts?: {
    maxAge?: number
    includeSubDomains?: boolean
    preload?: boolean
  }
}

/**
 * 缓存配置
 */
export interface NitroCacheConfig {
  /**
   * 缓存策略
   */
  strategy?: CacheStrategy
  
  /**
   * 缓存时间（秒）
   */
  maxAge?: number
  
  /**
   * 是否可变
   */
  vary?: string[]
  
  /**
   * ETag 配置
   */
  etag?: boolean
  
  /**
   * 自定义缓存键
   */
  key?: (event: any) => string
}

/**
 * 日志配置
 */
export interface NitroLoggingConfig {
  /**
   * 是否启用日志
   */
  enabled?: boolean
  
  /**
   * 日志级别
   */
  level?: 'debug' | 'info' | 'warn' | 'error'
  
  /**
   * 是否记录请求
   */
  requests?: boolean
  
  /**
   * 是否记录响应
   */
  responses?: boolean
  
  /**
   * 是否记录错误
   */
  errors?: boolean
  
  /**
   * 自定义格式化器
   */
  formatter?: (data: any) => string
}

/**
 * Nitro 模块配置选项
 */
export interface NitroModuleOptions {
  /**
   * API 路由前缀
   */
  prefix?: string
  
  /**
   * 是否启用开发模式
   */
  development?: boolean
  
  /**
   * 是否启用调试模式
   */
  debug?: boolean
  
  /**
   * CORS 配置
   */
  cors?: NitroCorsConfig
  
  /**
   * 速率限制配置
   */
  rateLimit?: NitroRateLimitConfig
  
  /**
   * 压缩配置
   */
  compression?: NitroCompressionConfig
  
  /**
   * 安全配置
   */
  security?: NitroSecurityConfig
  
  /**
   * 缓存配置
   */
  cache?: NitroCacheConfig
  
  /**
   * 日志配置
   */
  logging?: NitroLoggingConfig
  
  /**
   * 静态文件配置
   */
  static?: {
    enabled?: boolean
    root?: string
    prefix?: string
    maxAge?: number
  }
  
  /**
   * 中间件配置
   */
  middleware?: {
    global?: any[]
    routes?: Record<string, any[]>
  }
  
  /**
   * 插件配置
   */
  plugins?: any[]
  
  /**
   * 自定义配置
   */
  custom?: Record<string, any>
}

/**
 * Nitro 异步模块配置选项
 */
export interface NitroModuleAsyncOptions {
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
  useFactory?: (...args: any[]) => NitroModuleOptions | Promise<NitroModuleOptions>
  
  /**
   * 使用类创建配置
   */
  useClass?: new (...args: any[]) => NitroOptionsFactory
  
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
 * Nitro 配置工厂接口
 */
export interface NitroOptionsFactory {
  createNitroOptions(): NitroModuleOptions | Promise<NitroModuleOptions>
}

/**
 * 路由处理器配置
 */
export interface RouteHandlerConfig {
  /**
   * 路由路径
   */
  path?: string
  
  /**
   * HTTP 方法
   */
  method?: string | string[]
  
  /**
   * 响应类型
   */
  responseType?: ResponseType
  
  /**
   * 缓存配置
   */
  cache?: NitroCacheConfig
  
  /**
   * 速率限制配置
   */
  rateLimit?: NitroRateLimitConfig
  
  /**
   * CORS 配置
   */
  cors?: NitroCorsConfig
  
  /**
   * 中间件
   */
  middleware?: any[]
  
  /**
   * 描述
   */
  description?: string
  
  /**
   * 标签
   */
  tags?: string[]
  
  /**
   * 自定义元数据
   */
  meta?: Record<string, any>
}