import { SetMetadata } from '@nestjs/common'
import type { ZodSchema } from 'zod'
import { 
  TRPC_METADATA_KEYS, 
  type TrpcProcedureType, 
  type TrpcProcedureMetadata 
} from '../interfaces/trpc-procedure-metadata.interface.js'

/**
 * tRPC 过程配置选项
 */
export interface TrpcProcedureOptions {
  /**
   * 过程名称，默认使用方法名
   */
  name?: string
  
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
 * 通用 tRPC 过程装饰器
 * 
 * @param type 过程类型
 * @param options 过程配置选项
 */
export function TrpcProcedure(
  type: TrpcProcedureType,
  options: TrpcProcedureOptions = {}
): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const methodName = String(propertyKey)
    
    const metadata: TrpcProcedureMetadata = {
      type,
      name: options.name || methodName,
      input: options.input,
      output: options.output,
      description: options.description,
      requireAuth: options.requireAuth,
      permissions: options.permissions,
      middleware: options.middleware,
      meta: options.meta,
    }
    
    // 设置过程元数据
    SetMetadata(TRPC_METADATA_KEYS.PROCEDURE, metadata)(target, propertyKey, descriptor)
    
    // 设置特定类型的元数据
    const typeKey = type === 'query' 
      ? TRPC_METADATA_KEYS.QUERY 
      : type === 'mutation' 
      ? TRPC_METADATA_KEYS.MUTATION 
      : TRPC_METADATA_KEYS.SUBSCRIPTION
    
    SetMetadata(typeKey, metadata)(target, propertyKey, descriptor)
    
    return descriptor
  }
}

/**
 * 输入验证装饰器
 */
export function Input(schema: ZodSchema): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(TRPC_METADATA_KEYS.INPUT, schema)(target, propertyKey, descriptor)
    return descriptor
  }
}

/**
 * 输出验证装饰器
 */
export function Output(schema: ZodSchema): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(TRPC_METADATA_KEYS.OUTPUT, schema)(target, propertyKey, descriptor)
    return descriptor
  }
}

/**
 * 认证装饰器
 */
export function RequireAuth(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(TRPC_METADATA_KEYS.AUTH, true)(target, propertyKey, descriptor)
    return descriptor
  }
}

/**
 * 权限装饰器
 */
export function RequirePermissions(...permissions: string[]): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(TRPC_METADATA_KEYS.PERMISSIONS, permissions)(target, propertyKey, descriptor)
    return descriptor
  }
}

/**
 * 获取过程元数据
 */
export function getTrpcProcedureMetadata(target: any, propertyKey: string): TrpcProcedureMetadata | undefined {
  return Reflect.getMetadata(TRPC_METADATA_KEYS.PROCEDURE, target, propertyKey)
}

/**
 * 检查是否为 tRPC 过程
 */
export function isTrpcProcedure(target: any, propertyKey: string): boolean {
  return Reflect.hasMetadata(TRPC_METADATA_KEYS.PROCEDURE, target, propertyKey)
}