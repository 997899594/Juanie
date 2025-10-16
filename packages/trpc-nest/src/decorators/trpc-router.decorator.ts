import { SetMetadata } from '@nestjs/common'
import type { TrpcRouterOptions } from '../interfaces/trpc-options.interface'

export const TRPC_ROUTER_METADATA = 'trpc:router'

export const TrpcRouter = (options?: TrpcRouterOptions) => {
  return SetMetadata(TRPC_ROUTER_METADATA, options || {})
}