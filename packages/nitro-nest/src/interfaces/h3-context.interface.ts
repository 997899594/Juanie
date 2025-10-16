import type { H3Event, EventHandlerRequest } from 'h3'

/**
 * H3 事件上下文
 */
export interface H3EventContext {
  /**
   * 原始 H3 事件
   */
  event: H3Event<EventHandlerRequest>
  
  /**
   * 请求 URL
   */
  url: string
  
  /**
   * 请求路径
   */
  path?: string
  
  /**
   * HTTP 方法
   */
  method: string
  
  /**
   * 请求头
   */
  headers: Partial<Record<string, string>>
  
  /**
   * 查询参数
   */
  query: Record<string, string | string[]>
  
  /**
   * 路径参数
   */
  params: Record<string, string>
  
  /**
   * 请求体
   */
  body?: any
  
  /**
   * 文件上传
   */
  files?: any[]
  
  /**
   * 客户端 IP
   */
  ip?: string
  
  /**
   * 用户代理
   */
  userAgent?: string
  
  /**
   * 请求时间戳
   */
  timestamp?: Date
  
  /**
   * 请求 ID
   */
  requestId?: string
  
  /**
   * Cookies
   */
  cookies?: Record<string, string>
  
  /**
   * 会话信息
   */
  session?: any
  
  /**
   * 认证信息
   */
  auth?: {
    user?: any
    token?: string
    permissions?: string[]
    [key: string]: any
  }
  
  /**
   * 自定义上下文数据
   */
  custom?: Record<string, any>
  
  /**
   * 元数据
   */
  metadata?: Record<string, any>
}

/**
 * H3 响应上下文
 */
export interface H3ResponseContext {
  /**
   * 响应状态码
   */
  statusCode?: number
  
  /**
   * 响应头
   */
  headers?: Record<string, string | string[]>
  
  /**
   * 响应体
   */
  body?: any
  
  /**
   * 响应类型
   */
  contentType?: string
  
  /**
   * 缓存控制
   */
  cacheControl?: string
  
  /**
   * ETag
   */
  etag?: string
  
  /**
   * 重定向 URL
   */
  redirect?: string
  
  /**
   * Cookie 设置
   */
  cookies?: Array<{
    name: string
    value: string
    options?: any
  }>
  
  /**
   * 响应是否已发送
   */
  sent?: boolean
}

/**
 * H3 中间件上下文
 */
export interface H3MiddlewareContext {
  /**
   * 事件上下文
   */
  event: H3EventContext
  
  /**
   * 响应上下文
   */
  response: H3ResponseContext
  
  /**
   * 下一个中间件
   */
  next: () => Promise<void> | void
  
  /**
   * 错误处理
   */
  error?: (error: Error) => void
  
  /**
   * 中间件元数据
   */
  meta?: {
    name?: string
    priority?: number
    tags?: string[]
  }
}

/**
 * H3 错误上下文
 */
export interface H3ErrorContext {
  /**
   * 错误对象
   */
  error: Error
  
  /**
   * 错误代码
   */
  code?: string
  
  /**
   * HTTP 状态码
   */
  statusCode?: number
  
  /**
   * 错误消息
   */
  message?: string
  
  /**
   * 错误详情
   */
  details?: any
  
  /**
   * 错误堆栈
   */
  stack?: string
  
  /**
   * 事件上下文
   */
  event?: H3EventContext
  
  /**
   * 时间戳
   */
  timestamp?: Date
}

/**
 * H3 路由信息
 */
export interface H3RouteInfo {
  /**
   * 路由路径
   */
  path: string
  
  /**
   * HTTP 方法
   */
  method: string
  
  /**
   * 路由参数
   */
  params: Record<string, string>
  
  /**
   * 匹配的路由模式
   */
  matched?: string
  
  /**
   * 路由处理器
   */
  handler?: string
  
  /**
   * 路由名称
   */
  name?: string
  
  /**
   * 路由元数据
   */
  meta?: Record<string, any>
}

/**
 * H3 请求统计
 */
export interface H3RequestStats {
  /**
   * 请求 ID
   */
  id: string
  
  /**
   * 开始时间
   */
  startTime: Date
  
  /**
   * 结束时间
   */
  endTime?: Date
  
  /**
   * 持续时间（毫秒）
   */
  duration?: number
  
  /**
   * 请求大小（字节）
   */
  requestSize?: number
  
  /**
   * 响应大小（字节）
   */
  responseSize?: number
  
  /**
   * 内存使用
   */
  memoryUsage?: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
}

/**
 * H3 会话接口
 */
export interface H3Session {
  /**
   * 会话 ID
   */
  id: string
  
  /**
   * 会话数据
   */
  data: Record<string, any>
  
  /**
   * 创建时间
   */
  createdAt: Date
  
  /**
   * 最后访问时间
   */
  lastAccessedAt: Date
  
  /**
   * 过期时间
   */
  expiresAt?: Date
  
  /**
   * 是否已过期
   */
  isExpired(): boolean
  
  /**
   * 设置数据
   */
  set(key: string, value: any): void
  
  /**
   * 获取数据
   */
  get<T = any>(key: string): T | undefined
  
  /**
   * 删除数据
   */
  delete(key: string): void
  
  /**
   * 清空会话
   */
  clear(): void
  
  /**
   * 销毁会话
   */
  destroy(): void
}