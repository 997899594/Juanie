import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ModuleRef, Reflector } from '@nestjs/core'
import type { H3Event } from 'h3'
import { H3, eventHandler, toNodeHandler } from 'h3'
import type { NitroModuleOptions, RouteHandlerConfig } from '../interfaces/nitro-options.interface.js'
import type { H3EventContext, H3RequestStats } from '../interfaces/h3-context.interface.js'
import { H3Adapter } from '../adapters/h3-adapter.js'
import { 
  METADATA_KEYS,
  HttpMethod,
  HandlerType,
  ResponseType 
} from '../constants/nitro.constants.js'

/**
 * Nitro 服务类
 * 负责管理 Nitro 应用、路由注册和请求处理
 */
@Injectable()
export class NitroService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NitroService.name)
  private nitroApp: any
  private router: any
  private handlers = new Map<string, any>()
  private middleware = new Map<string, any>()
  private stats = {
    requests: 0,
    errors: 0,
    averageResponseTime: 0,
    uptime: Date.now()
  }

  constructor(
    private readonly options: NitroModuleOptions,
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
    private readonly h3Adapter: H3Adapter
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Nitro service...')
    
    try {
      // 创建 Nitro 应用
      this.nitroApp = new H3({
        debug: this.options.debug || false
      })
      
      // 创建路由器（使用同一个 H3 实例）
      this.router = new H3()
      
      // 注册全局中间件
      await this.registerGlobalMiddleware()
      
      // 发现并注册路由处理器
      await this.discoverHandlers()
      
      // 将路由器添加到应用
      this.nitroApp.use(this.router)
      
      this.logger.log('Nitro service initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize Nitro service:', error)
      throw error
    }
  }

  async onModuleDestroy() {
    this.logger.log('Destroying Nitro service...')
    
    try {
      // 清理资源
      this.handlers.clear()
      this.middleware.clear()
      
      this.logger.log('Nitro service destroyed successfully')
    } catch (error) {
      this.logger.error('Failed to destroy Nitro service:', error)
    }
  }

  /**
   * 获取 Nitro 应用实例
   */
  getApp() {
    return this.nitroApp
  }

  /**
   * 获取 Node.js 监听器
   */
  getNodeListener() {
    return toNodeHandler(this.nitroApp)
  }

  /**
   * 注册路由处理器
   */
  registerHandler(
    path: string, 
    method: HttpMethod, 
    handler: Function, 
    config?: RouteHandlerConfig
  ) {
    const key = `${method}:${path}`
    
    try {
      const wrappedHandler = this.wrapHandler(handler, config)
      
      // 根据方法注册路由
      switch (method) {
        case HttpMethod.GET:
          this.router.get(path, wrappedHandler)
          break
        case HttpMethod.POST:
          this.router.post(path, wrappedHandler)
          break
        case HttpMethod.PUT:
          this.router.put(path, wrappedHandler)
          break
        case HttpMethod.DELETE:
          this.router.delete(path, wrappedHandler)
          break
        case HttpMethod.PATCH:
          this.router.patch(path, wrappedHandler)
          break
        case HttpMethod.HEAD:
          this.router.head(path, wrappedHandler)
          break
        case HttpMethod.OPTIONS:
          this.router.options(path, wrappedHandler)
          break
        default:
          this.router.use(path, wrappedHandler)
      }
      
      this.handlers.set(key, { handler, config })
      this.logger.log(`Registered handler: ${method} ${path}`)
    } catch (error) {
      this.logger.error(`Failed to register handler ${method} ${path}:`, error)
      throw error
    }
  }

  /**
   * 注册中间件
   */
  registerMiddleware(path: string, middleware: Function, config?: any) {
    try {
      const wrappedMiddleware = this.wrapMiddleware(middleware, config)
      this.router.use(path, wrappedMiddleware)
      this.middleware.set(path, { middleware, config })
      this.logger.log(`Registered middleware: ${path}`)
    } catch (error) {
      this.logger.error(`Failed to register middleware ${path}:`, error)
      throw error
    }
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime,
      handlers: this.handlers.size,
      middleware: this.middleware.size
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const stats = this.getStats()
      
      return {
        status: 'healthy',
        details: {
          service: 'nitro-nest',
          version: '1.0.0',
          uptime: stats.uptime,
          requests: stats.requests,
          errors: stats.errors,
          averageResponseTime: stats.averageResponseTime,
          handlers: stats.handlers,
          middleware: stats.middleware,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      this.logger.error('Health check failed:', error)
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  /**
   * 发现并注册处理器
   */
  private async discoverHandlers() {
    const providers = this.moduleRef['container'].getModules()
    
    for (const [, module] of providers) {
      const components = (module as any).components || new Map()
      
      for (const [, component] of components) {
        if (!component.instance) continue
        
        const instance = component.instance
        const prototype = Object.getPrototypeOf(instance)
        
        // 获取所有方法
        const methods = Object.getOwnPropertyNames(prototype)
          .filter(method => method !== 'constructor' && typeof instance[method] === 'function')
        
        for (const methodName of methods) {
          const handler = instance[methodName].bind(instance)
          
          // 检查是否有路由元数据
          const routeMetadata = this.reflector.get(METADATA_KEYS.HANDLER, handler)
          if (routeMetadata) {
            await this.registerHandlerFromMetadata(handler, routeMetadata)
          }
          
          // 检查是否有中间件元数据
          const middlewareMetadata = this.reflector.get(METADATA_KEYS.MIDDLEWARE, handler)
          if (middlewareMetadata) {
            await this.registerMiddlewareFromMetadata(handler, middlewareMetadata)
          }
        }
      }
    }
  }

  /**
   * 从元数据注册处理器
   */
  private async registerHandlerFromMetadata(handler: Function, metadata: any) {
    const { path, method, ...config } = metadata
    
    // 合并缓存配置
    const cacheMetadata = this.reflector.get(METADATA_KEYS.CACHE, handler)
    if (cacheMetadata) {
      config.cache = { ...config.cache, ...cacheMetadata }
    }
    
    // 合并速率限制配置
    const rateLimitMetadata = this.reflector.get(METADATA_KEYS.RATE_LIMIT, handler)
    if (rateLimitMetadata) {
      config.rateLimit = { ...config.rateLimit, ...rateLimitMetadata }
    }
    
    // 合并 CORS 配置
    const corsMetadata = this.reflector.get(METADATA_KEYS.CORS, handler)
    if (corsMetadata) {
      config.cors = { ...config.cors, ...corsMetadata }
    }
    
    this.registerHandler(path, method, handler, config)
  }

  /**
   * 从元数据注册中间件
   */
  private async registerMiddlewareFromMetadata(middleware: Function, metadata: any) {
    const { path, ...config } = metadata
    this.registerMiddleware(path, middleware, config)
  }

  /**
   * 包装处理器
   */
  private wrapHandler(handler: Function, config?: RouteHandlerConfig) {
    return eventHandler(async (event: H3Event) => {
      const startTime = Date.now()
      
      try {
        this.stats.requests++
        
        // 验证请求
        if (!this.h3Adapter.validateRequest(event)) {
          throw new Error('Invalid request')
        }
        
        // 应用 CORS
        if (config?.cors) {
          this.applyCors(event, config.cors)
        }
        
        // 应用速率限制
        if (config?.rateLimit) {
          await this.applyRateLimit(event, config.rateLimit)
        }
        
        // 转换请求
        const request = await this.h3Adapter.adaptRequest(event)
        const response = this.h3Adapter.createResponse(event)
        
        // 创建执行上下文（模拟 NestJS ExecutionContext）
        const executionContext = this.createExecutionContext(request, response)
        
        // 执行处理器
        const result = await handler(executionContext)
        
        // 处理响应
        await this.handleResponse(event, result, config)
        
        // 更新统计信息
        const duration = Date.now() - startTime
        this.updateStats(duration)
        
        return result
      } catch (error) {
        this.stats.errors++
        this.logger.error('Handler execution failed:', error)
        this.h3Adapter.handleError(event, error)
        throw error
      }
    })
  }

  /**
   * 包装中间件
   */
  private wrapMiddleware(middleware: Function, config?: any) {
    return eventHandler(async (event: H3Event) => {
      try {
        const context = this.h3Adapter.createMiddlewareContext(event)
        await middleware(context)
        
        // 中间件上下文不再有 skip 属性，使用其他方式判断
        if (context.response.statusCode && context.response.statusCode >= 400) {
          return
        }
        
        if (context.error) {
          throw new Error('Middleware error')
        }
      } catch (error) {
        this.logger.error('Middleware execution failed:', error)
        this.h3Adapter.handleError(event, error)
        throw error
      }
    })
  }

  /**
   * 注册全局中间件
   */
  private async registerGlobalMiddleware() {
    // 请求日志中间件
    if (this.options.logging?.enabled !== false) {
      this.nitroApp.use(eventHandler(async (event: H3Event) => {
        if (!event.node?.req || !event.node?.res) {
          return
        }
        
        const start = Date.now()
        const { method, url } = event.node.req
        
        event.node.res.on('finish', () => {
          const duration = Date.now() - start
          this.logger.log(`${method} ${url} - ${event.node?.res?.statusCode} - ${duration}ms`)
        })
      }))
    }
    
    // 错误处理中间件
    this.nitroApp.use(eventHandler(async (event: H3Event) => {
      try {
        // 继续处理
      } catch (error) {
        this.h3Adapter.handleError(event, error)
      }
    }))
  }

  /**
   * 应用 CORS 配置
   */
  private applyCors(event: H3Event, corsConfig: any) {
    const { origin, methods, headers, credentials } = corsConfig
    
    if (!event.node?.res) {
      return
    }
    
    if (origin) {
      event.node.res.setHeader('Access-Control-Allow-Origin', origin)
    }
    
    if (methods) {
      event.node.res.setHeader('Access-Control-Allow-Methods', methods.join(', '))
    }
    
    if (headers) {
      event.node.res.setHeader('Access-Control-Allow-Headers', headers.join(', '))
    }
    
    if (credentials) {
      event.node.res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
  }

  /**
   * 应用速率限制
   */
  private async applyRateLimit(event: H3Event, rateLimitConfig: any) {
    // 简单的内存速率限制实现
    // 生产环境应该使用 Redis 等外部存储
    const { windowMs, max } = rateLimitConfig
    
    if (!event.node?.req?.socket) {
      return
    }
    
    const ip = event.node.req.socket.remoteAddress
    const key = `rate_limit:${ip}`
    
    // 这里需要实现速率限制逻辑
    // 暂时跳过实现
  }

  /**
   * 处理响应
   */
  private async handleResponse(event: H3Event, result: any, config?: RouteHandlerConfig) {
    if (result === undefined || result === null) {
      return
    }
    
    if (!event.node?.res) {
      return result
    }
    
    // 设置响应类型
    if (config?.responseType === ResponseType.JSON) {
      event.node.res.setHeader('content-type', 'application/json')
      return JSON.stringify(result)
    } else if (config?.responseType === ResponseType.TEXT) {
      event.node.res.setHeader('content-type', 'text/plain')
      return String(result)
    } else if (config?.responseType === ResponseType.HTML) {
      event.node.res.setHeader('content-type', 'text/html')
      return String(result)
    }
    
    // 默认 JSON 响应
    if (typeof result === 'object') {
      event.node.res.setHeader('content-type', 'application/json')
      return JSON.stringify(result)
    }
    
    return result
  }

  /**
   * 创建执行上下文
   */
  private createExecutionContext(request: any, response: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      }),
      getClass: () => null,
      getHandler: () => null,
      getArgs: () => [request, response],
      getArgByIndex: (index: number) => [request, response][index],
      switchToRpc: () => ({}),
      switchToWs: () => ({})
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(duration: number) {
    const totalRequests = this.stats.requests
    const currentAverage = this.stats.averageResponseTime
    
    this.stats.averageResponseTime = 
      (currentAverage * (totalRequests - 1) + duration) / totalRequests
  }
}