import { SetMetadata } from '@nestjs/common'
import type { RouteHandlerConfig } from '../interfaces/nitro-options.interface.js'
import { METADATA_KEYS, HttpMethod, HandlerType } from '../constants/nitro.constants.js'

/**
 * Nitro 处理器装饰器
 * 
 * @param config 路由处理器配置
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserController {
 *   @NitroHandler({
 *     path: '/users',
 *     method: 'GET',
 *     cache: { strategy: CacheStrategy.PUBLIC, maxAge: 300 }
 *   })
 *   async getUsers(@H3Context() ctx: H3EventContext) {
 *     return { users: [] }
 *   }
 * }
 * ```
 */
export function NitroHandler(config: RouteHandlerConfig = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = {
      type: HandlerType.API,
      path: config.path || `/${String(propertyKey)}`,
      method: config.method || HttpMethod.GET,
      responseType: config.responseType,
      cache: config.cache,
      rateLimit: config.rateLimit,
      cors: config.cors,
      middleware: config.middleware || [],
      description: config.description,
      tags: config.tags || [],
      meta: config.meta || {},
    }

    SetMetadata(METADATA_KEYS.HANDLER, metadata)(target, propertyKey, descriptor)
    return descriptor
  }
}

/**
 * GET 请求装饰器
 * 
 * @example
 * ```typescript
 * @Get('/users')
 * async getUsers() {
 *   return { users: [] }
 * }
 * ```
 */
export function Get(path?: string, config?: Omit<RouteHandlerConfig, 'path' | 'method'>): MethodDecorator {
  return NitroHandler({
    ...config,
    path,
    method: HttpMethod.GET,
  })
}

/**
 * POST 请求装饰器
 */
export function Post(path?: string, config?: Omit<RouteHandlerConfig, 'path' | 'method'>): MethodDecorator {
  return NitroHandler({
    ...config,
    path,
    method: HttpMethod.POST,
  })
}

/**
 * PUT 请求装饰器
 */
export function Put(path?: string, config?: Omit<RouteHandlerConfig, 'path' | 'method'>): MethodDecorator {
  return NitroHandler({
    ...config,
    path,
    method: HttpMethod.PUT,
  })
}

/**
 * DELETE 请求装饰器
 */
export function Delete(path?: string, config?: Omit<RouteHandlerConfig, 'path' | 'method'>): MethodDecorator {
  return NitroHandler({
    ...config,
    path,
    method: HttpMethod.DELETE,
  })
}

/**
 * PATCH 请求装饰器
 */
export function Patch(path?: string, config?: Omit<RouteHandlerConfig, 'path' | 'method'>): MethodDecorator {
  return NitroHandler({
    ...config,
    path,
    method: HttpMethod.PATCH,
  })
}

/**
 * 中间件装饰器
 * 
 * @example
 * ```typescript
 * @Middleware('/auth')
 * async authMiddleware(@H3Context() ctx: H3EventContext, @Next() next: Function) {
 *   // 认证逻辑
 *   await next()
 * }
 * ```
 */
export function Middleware(path?: string, config?: Omit<RouteHandlerConfig, 'path'>): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = {
      type: HandlerType.MIDDLEWARE,
      path: path || '/*',
      middleware: config?.middleware || [],
      description: config?.description,
      tags: config?.tags || [],
      meta: config?.meta || {},
    }

    SetMetadata(METADATA_KEYS.MIDDLEWARE, metadata)(target, propertyKey, descriptor)
    return descriptor
  }
}

/**
 * 缓存装饰器
 * 
 * @example
 * ```typescript
 * @Cache({ strategy: CacheStrategy.PUBLIC, maxAge: 300 })
 * @Get('/data')
 * async getData() {
 *   return { data: 'cached' }
 * }
 * ```
 */
export function Cache(config: RouteHandlerConfig['cache']): MethodDecorator {
  return SetMetadata(METADATA_KEYS.CACHE, config)
}

/**
 * 速率限制装饰器
 * 
 * @example
 * ```typescript
 * @RateLimit({ max: 10, windowMs: 60000 })
 * @Post('/login')
 * async login() {
 *   // 登录逻辑
 * }
 * ```
 */
export function RateLimit(config: RouteHandlerConfig['rateLimit']): MethodDecorator {
  return SetMetadata(METADATA_KEYS.RATE_LIMIT, config)
}

/**
 * CORS 装饰器
 * 
 * @example
 * ```typescript
 * @Cors({ origin: 'https://example.com' })
 * @Get('/api/data')
 * async getData() {
 *   return { data: 'cors enabled' }
 * }
 * ```
 */
export function Cors(config: RouteHandlerConfig['cors']): MethodDecorator {
  return SetMetadata(METADATA_KEYS.CORS, config)
}

/**
 * 获取处理器元数据
 */
export function getHandlerMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata(METADATA_KEYS.HANDLER, target, propertyKey)
}

/**
 * 获取中间件元数据
 */
export function getMiddlewareMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, target, propertyKey)
}

/**
 * 获取缓存元数据
 */
export function getCacheMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata(METADATA_KEYS.CACHE, target, propertyKey)
}

/**
 * 获取速率限制元数据
 */
export function getRateLimitMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata(METADATA_KEYS.RATE_LIMIT, target, propertyKey)
}

/**
 * 获取 CORS 元数据
 */
export function getCorsMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata(METADATA_KEYS.CORS, target, propertyKey)
}

/**
 * 检查是否为 Nitro 处理器
 */
export function isNitroHandler(target: any, propertyKey: string): boolean {
  return Reflect.hasMetadata(METADATA_KEYS.HANDLER, target, propertyKey)
}

/**
 * 检查是否为 Nitro 中间件
 */
export function isNitroMiddleware(target: any, propertyKey: string): boolean {
  return Reflect.hasMetadata(METADATA_KEYS.MIDDLEWARE, target, propertyKey)
}