import type { ZodSchema } from 'zod'

/**
 * tRPC 过程类型
 */
export type TrpcProcedureType = 'query' | 'mutation' | 'subscription'

/**
 * tRPC 过程元数据
 */
export interface TrpcProcedureMetadata {
  /**
   * 过程类型
   */
  type: TrpcProcedureType
  
  /**
   * 过程名称
   */
  name: string
  
  /**
   * 输入验证 schema
   */
  input?: ZodSchema
  
  /**
   * 输出验证 schema
   */
  output?: ZodSchema
  
  /**
   * 过程描述
   */
  description?: string
  
  /**
   * 是否需要认证
   */
  requireAuth?: boolean
  
  /**
   * 所需权限
   */
  permissions?: string[]
  
  /**
   * 中间件列表
   */
  middleware?: string[]
  
  /**
   * 自定义元数据
   */
  meta?: Record<string, any>
}

/**
 * tRPC 路由器元数据
 */
export interface TrpcRouterMetadata {
  /**
   * 路由器名称
   */
  name: string
  
  /**
   * 路由器路径前缀
   */
  prefix?: string
  
  /**
   * 路由器描述
   */
  description?: string
  
  /**
   * 过程列表
   */
  procedures: TrpcProcedureMetadata[]
  
  /**
   * 子路由器
   */
  subRouters?: TrpcRouterMetadata[]
  
  /**
   * 全局中间件
   */
  middleware?: string[]
  
  /**
   * 自定义元数据
   */
  meta?: Record<string, any>
}

/**
 * tRPC 装饰器元数据键
 */
export const TRPC_METADATA_KEYS = {
  ROUTER: Symbol('trpc:router'),
  PROCEDURE: Symbol('trpc:procedure'),
  QUERY: Symbol('trpc:query'),
  MUTATION: Symbol('trpc:mutation'),
  SUBSCRIPTION: Symbol('trpc:subscription'),
  INPUT: Symbol('trpc:input'),
  OUTPUT: Symbol('trpc:output'),
  MIDDLEWARE: Symbol('trpc:middleware'),
  AUTH: Symbol('trpc:auth'),
  PERMISSIONS: Symbol('trpc:permissions'),
} as const