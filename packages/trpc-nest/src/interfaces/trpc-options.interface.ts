import type { AnyRouter, initTRPC } from '@trpc/server'

/**
 * tRPC 模块配置选项
 */
export interface TrpcModuleOptions {
  /**
   * tRPC 实例，通过 initTRPC.create() 创建
   */
  trpc: ReturnType<typeof initTRPC.create>
  
  /**
   * 上下文创建函数
   */
  createContext?: (req: any, res?: any) => any | Promise<any>
  
  /**
   * 是否启用全局前缀
   * @default false
   */
  useGlobalPrefix?: boolean
  
  /**
   * 路由前缀
   * @default 'trpc'
   */
  prefix?: string
  
  /**
   * 是否启用开发模式
   * @default false
   */
  development?: boolean
}

/**
 * tRPC 异步模块配置选项
 */
export interface TrpcModuleAsyncOptions {
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
  useFactory?: (...args: any[]) => TrpcModuleOptions | Promise<TrpcModuleOptions>
  
  /**
   * 使用类创建配置
   */
  useClass?: new (...args: any[]) => TrpcOptionsFactory
  
  /**
   * 使用现有的配置提供者
   */
  useExisting?: any
  
  /**
   * 是否为全局模块
   * @default false
   */
  isGlobal?: boolean
}

/**
 * tRPC 配置工厂接口
 */
export interface TrpcOptionsFactory {
  createTrpcOptions(): TrpcModuleOptions | Promise<TrpcModuleOptions>
}

/**
 * tRPC 路由器配置选项
 */
export interface TrpcRouterOptions {
  /**
   * 路由器名称
   */
  name?: string
  
  /**
   * 路由器路径
   */
  path?: string
  
  /**
   * 是否启用中间件
   */
  middleware?: boolean
}

/**
 * tRPC 路由器配置
 */
export interface TrpcRouterConfig {
  /**
   * 路由器名称
   */
  name?: string
  
  /**
   * 路由器路径
   */
  path?: string
  
  /**
   * 是否启用中间件
   */
  middleware?: boolean
}