import { TRPC_METADATA_KEYS, type TrpcProcedureMetadata, type TrpcRouterMetadata } from '../interfaces/trpc-procedure-metadata.interface.js'

/**
 * 获取类的所有 tRPC 过程元数据
 */
export function getAllTrpcProcedures(target: any): Array<{ 
  methodName: string
  metadata: TrpcProcedureMetadata 
}> {
  const procedures: Array<{ methodName: string; metadata: TrpcProcedureMetadata }> = []
  
  // 获取类的原型
  const prototype = target.prototype || target
  
  // 获取所有方法名
  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    name => name !== 'constructor' && typeof prototype[name] === 'function'
  )
  
  // 检查每个方法是否有 tRPC 过程元数据
  for (const methodName of methodNames) {
    const metadata = Reflect.getMetadata(TRPC_METADATA_KEYS.PROCEDURE, prototype, methodName)
    if (metadata) {
      procedures.push({ methodName, metadata })
    }
  }
  
  return procedures
}

/**
 * 获取类的路由器元数据
 */
export function getTrpcRouterMetadata(target: any): TrpcRouterMetadata | undefined {
  return Reflect.getMetadata(TRPC_METADATA_KEYS.ROUTER, target)
}

/**
 * 检查类是否为 tRPC 路由器
 */
export function isTrpcRouter(target: any): boolean {
  return Reflect.hasMetadata(TRPC_METADATA_KEYS.ROUTER, target)
}

/**
 * 获取方法的输入验证 schema
 */
export function getInputSchema(target: any, methodName: string) {
  return Reflect.getMetadata(TRPC_METADATA_KEYS.INPUT, target, methodName)
}

/**
 * 获取方法的输出验证 schema
 */
export function getOutputSchema(target: any, methodName: string) {
  return Reflect.getMetadata(TRPC_METADATA_KEYS.OUTPUT, target, methodName)
}

/**
 * 检查方法是否需要认证
 */
export function requiresAuth(target: any, methodName: string): boolean {
  const procedureMetadata = Reflect.getMetadata(TRPC_METADATA_KEYS.PROCEDURE, target, methodName)
  const authMetadata = Reflect.getMetadata(TRPC_METADATA_KEYS.AUTH, target, methodName)
  
  return procedureMetadata?.requireAuth || authMetadata || false
}

/**
 * 获取方法所需的权限
 */
export function getRequiredPermissions(target: any, methodName: string): string[] {
  const procedureMetadata = Reflect.getMetadata(TRPC_METADATA_KEYS.PROCEDURE, target, methodName)
  const permissionsMetadata = Reflect.getMetadata(TRPC_METADATA_KEYS.PERMISSIONS, target, methodName)
  
  return procedureMetadata?.permissions || permissionsMetadata || []
}

/**
 * 合并过程元数据
 */
export function mergeProcedureMetadata(
  base: Partial<TrpcProcedureMetadata>,
  override: Partial<TrpcProcedureMetadata>
): TrpcProcedureMetadata {
  return {
    type: override.type || base.type || 'query',
    name: override.name || base.name || '',
    input: override.input || base.input,
    output: override.output || base.output,
    description: override.description || base.description,
    requireAuth: override.requireAuth ?? base.requireAuth ?? false,
    permissions: [...(base.permissions || []), ...(override.permissions || [])],
    middleware: [...(base.middleware || []), ...(override.middleware || [])],
    meta: { ...base.meta, ...override.meta },
  }
}

/**
 * 验证过程元数据
 */
export function validateProcedureMetadata(metadata: TrpcProcedureMetadata): boolean {
  if (!metadata.name || typeof metadata.name !== 'string') {
    return false
  }
  
  if (!['query', 'mutation', 'subscription'].includes(metadata.type)) {
    return false
  }
  
  return true
}