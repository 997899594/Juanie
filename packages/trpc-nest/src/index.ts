export { TrpcModule } from './trpc.module'
export { TrpcService } from './trpc.service'
export { TrpcRouter } from './decorators/trpc-router.decorator'
export { TrpcProcedure } from './decorators/trpc-procedure.decorator'
export { TrpcQuery } from './decorators/trpc-query.decorator'
export { TrpcMutation } from './decorators/trpc-mutation.decorator'

// 导出类型
export type { TrpcModuleOptions, TrpcModuleAsyncOptions } from './interfaces/trpc-options.interface'
export type { TrpcContext } from './interfaces/trpc-context.interface'
export type { TrpcProcedureMetadata } from './interfaces/trpc-procedure-metadata.interface'