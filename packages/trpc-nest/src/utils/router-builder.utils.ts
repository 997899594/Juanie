import type { AnyRouter, ProcedureBuilder } from '@trpc/server'
import { getAllTrpcProcedures, getTrpcRouterMetadata } from './metadata.utils.js'
import type { TrpcProcedureMetadata } from '../interfaces/trpc-procedure-metadata.interface.js'

/**
 * 路由器构建选项
 */
export interface RouterBuilderOptions {
  /**
   * tRPC 实例
   */
  trpc: any
  
  /**
   * 上下文创建函数
   */
  createContext?: (req: any, res?: any) => any | Promise<any>
  
  /**
   * 全局中间件
   */
  middleware?: any[]
  
  /**
   * 是否启用开发模式
   */
  development?: boolean
}

/**
 * 从 NestJS 服务类构建 tRPC 路由器
 */
export function buildRouterFromService(
  serviceClass: any,
  serviceInstance: any,
  options: RouterBuilderOptions
): AnyRouter {
  const { trpc } = options
  
  // 获取路由器元数据
  const routerMetadata = getTrpcRouterMetadata(serviceClass)
  if (!routerMetadata) {
    throw new Error(`Class ${serviceClass.name} is not decorated with @TrpcRouter`)
  }
  
  // 获取所有过程
  const procedures = getAllTrpcProcedures(serviceClass)
  
  // 构建路由器对象
  const routerObject: Record<string, any> = {}
  
  for (const { methodName, metadata } of procedures) {
    const procedure = buildProcedure(
      trpc,
      metadata,
      serviceInstance,
      methodName,
      options
    )
    
    routerObject[metadata.name] = procedure
  }
  
  return trpc.router(routerObject)
}

/**
 * 构建单个过程
 */
function buildProcedure(
  trpc: any,
  metadata: TrpcProcedureMetadata,
  serviceInstance: any,
  methodName: string,
  options: RouterBuilderOptions
): any {
  let procedure: any
  
  // 根据类型选择基础过程
  switch (metadata.type) {
    case 'query':
      procedure = trpc.procedure
      break
    case 'mutation':
      procedure = trpc.procedure
      break
    case 'subscription':
      procedure = trpc.procedure
      break
    default:
      throw new Error(`Unknown procedure type: ${metadata.type}`)
  }
  
  // 添加输入验证
  if (metadata.input) {
    procedure = procedure.input(metadata.input)
  }
  
  // 添加输出验证
  if (metadata.output) {
    procedure = procedure.output(metadata.output)
  }
  
  // 添加中间件
  if (metadata.middleware && metadata.middleware.length > 0) {
    // 这里可以添加中间件逻辑
    // procedure = procedure.use(middlewareFunction)
  }
  
  // 添加认证中间件
  if (metadata.requireAuth) {
    procedure = procedure.use(async ({ ctx, next }: { ctx: any; next: any }) => {
      // 认证逻辑
      if (!ctx.user) {
        throw new Error('Unauthorized')
      }
      return next()
    })
  }
  
  // 添加权限检查中间件
  if (metadata.permissions && metadata.permissions.length > 0) {
    procedure = procedure.use(async ({ ctx, next }: { ctx: any; next: any }) => {
      // 权限检查逻辑
      const userPermissions = ctx.user?.permissions || []
      const hasPermission = metadata.permissions!.some(permission => 
        userPermissions.includes(permission)
      )
      
      if (!hasPermission) {
        throw new Error('Insufficient permissions')
      }
      
      return next()
    })
  }
  
  // 根据类型添加处理器
  const handler = async (opts: any) => {
    try {
      const result = await serviceInstance[methodName](opts.input, opts.ctx)
      return result
    } catch (error) {
      if (options.development) {
        console.error(`Error in ${methodName}:`, error)
      }
      throw error
    }
  }
  
  switch (metadata.type) {
    case 'query':
      return procedure.query(handler)
    case 'mutation':
      return procedure.mutation(handler)
    case 'subscription':
      return procedure.subscription(handler)
    default:
      throw new Error(`Unknown procedure type: ${metadata.type}`)
  }
}

/**
 * 合并多个路由器
 */
export function mergeRouters(
  trpc: any,
  routers: Record<string, AnyRouter>
): AnyRouter {
  return trpc.mergeRouters(routers)
}

/**
 * 创建嵌套路由器
 */
export function createNestedRouter(
  trpc: any,
  prefix: string,
  router: AnyRouter
): Record<string, AnyRouter> {
  return { [prefix]: router }
}

/**
 * 验证路由器配置
 */
export function validateRouterConfig(serviceClass: any): boolean {
  const routerMetadata = getTrpcRouterMetadata(serviceClass)
  if (!routerMetadata) {
    return false
  }
  
  const procedures = getAllTrpcProcedures(serviceClass)
  if (procedures.length === 0) {
    return false
  }
  
  // 检查过程名称是否唯一
  const procedureNames = procedures.map(p => p.metadata.name)
  const uniqueNames = new Set(procedureNames)
  
  return uniqueNames.size === procedureNames.length
}