import type { DynamicModule, Provider } from '@nestjs/common'
import { Global, Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { TrpcService } from './trpc.service.js'
import type { 
  TrpcModuleOptions, 
  TrpcModuleAsyncOptions, 
  TrpcOptionsFactory 
} from './interfaces/trpc-options.interface.js'

/**
 * tRPC 配置选项 Token
 */
export const TRPC_OPTIONS = Symbol('TRPC_OPTIONS')

/**
 * tRPC 模块
 * 提供 tRPC 与 NestJS 的集成功能
 */
@Global()
@Module({})
export class TrpcModule {
  /**
   * 同步注册 tRPC 模块
   */
  static forRoot(options: TrpcModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: TRPC_OPTIONS,
      useValue: options,
    }

    return {
      module: TrpcModule,
      imports: [DiscoveryModule],
      providers: [
        optionsProvider,
        {
          provide: TrpcService,
          useFactory: (trpcOptions: TrpcModuleOptions) => {
            const service = new TrpcService(
              null as any, // ModuleRef 将在运行时注入
              null as any, // DiscoveryService 将在运行时注入
              null as any  // MetadataScanner 将在运行时注入
            )
            service.setOptions(trpcOptions)
            return service
          },
          inject: [TRPC_OPTIONS],
        },
      ],
      exports: [TrpcService, TRPC_OPTIONS],
      global: true,
    }
  }

  /**
   * 异步注册 tRPC 模块
   */
  static forRootAsync(options: TrpcModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options)

    return {
      module: TrpcModule,
      imports: [
        DiscoveryModule,
        ...(options.imports || []),
      ],
      providers: [
        ...asyncProviders,
        {
          provide: TrpcService,
          useFactory: (trpcOptions: TrpcModuleOptions) => {
            const service = new TrpcService(
              null as any, // ModuleRef 将在运行时注入
              null as any, // DiscoveryService 将在运行时注入
              null as any  // MetadataScanner 将在运行时注入
            )
            service.setOptions(trpcOptions)
            return service
          },
          inject: [TRPC_OPTIONS],
        },
      ],
      exports: [TrpcService, TRPC_OPTIONS],
      global: options.isGlobal ?? true,
    }
  }

  /**
   * 创建异步提供者
   */
  private static createAsyncProviders(options: TrpcModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: TRPC_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ]
    }

    if (options.useClass) {
      return [
        {
          provide: TRPC_OPTIONS,
          useFactory: async (optionsFactory: TrpcOptionsFactory) =>
            await optionsFactory.createTrpcOptions(),
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ]
    }

    if (options.useExisting) {
      return [
        {
          provide: TRPC_OPTIONS,
          useFactory: async (optionsFactory: TrpcOptionsFactory) =>
            await optionsFactory.createTrpcOptions(),
          inject: [options.useExisting],
        },
      ]
    }

    throw new Error('Invalid TrpcModuleAsyncOptions')
  }
}

/**
 * tRPC 功能模块
 * 用于在特定模块中使用 tRPC 功能，而不需要全局注册
 */
@Module({})
export class TrpcFeatureModule {
  /**
   * 为特定模块注册 tRPC 功能
   */
  static forFeature(): DynamicModule {
    return {
      module: TrpcFeatureModule,
      providers: [],
      exports: [],
    }
  }
}