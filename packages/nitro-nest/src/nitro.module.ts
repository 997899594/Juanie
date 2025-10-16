import { DynamicModule, Module, Provider, Global } from '@nestjs/common'
import type { 
  NitroModuleOptions, 
  NitroModuleAsyncOptions, 
  NitroOptionsFactory 
} from './interfaces/nitro-options.interface.js'
import { NitroService } from './services/nitro.service.js'
import { H3Adapter } from './adapters/h3-adapter.js'
import { NITRO_OPTIONS } from './constants/nitro.constants.js'

/**
 * Nitro 模块
 * 提供 Nitro 和 NestJS 之间的桥梁功能
 */
@Global()
@Module({})
export class NitroModule {
  /**
   * 同步注册模块
   * 
   * @param options Nitro 模块配置选项
   * @returns 动态模块
   * 
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     NitroModule.forRoot({
   *       port: 3000,
   *       debug: true,
   *       cors: {
   *         origin: '*',
   *         methods: ['GET', 'POST']
   *       }
   *     })
   *   ]
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot(options: NitroModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: NITRO_OPTIONS,
        useValue: options
      },
      H3Adapter,
      {
        provide: NitroService,
        useFactory: (opts: NitroModuleOptions, adapter: H3Adapter) => {
          return new NitroService(opts, null as any, null as any, adapter)
        },
        inject: [NITRO_OPTIONS, H3Adapter]
      }
    ]

    return {
      module: NitroModule,
      providers,
      exports: [NitroService, H3Adapter, NITRO_OPTIONS]
    }
  }

  /**
   * 异步注册模块
   * 
   * @param options 异步配置选项
   * @returns 动态模块
   * 
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     NitroModule.forRootAsync({
   *       useFactory: (configService: ConfigService) => ({
   *         port: configService.get('PORT', 3000),
   *         debug: configService.get('NODE_ENV') === 'development',
   *         cors: {
   *           origin: configService.get('CORS_ORIGIN', '*'),
   *           methods: ['GET', 'POST', 'PUT', 'DELETE']
   *         }
   *       }),
   *       inject: [ConfigService]
   *     })
   *   ]
   * })
   * export class AppModule {}
   * ```
   */
  static forRootAsync(options: NitroModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...this.createAsyncProviders(options),
      H3Adapter,
      {
        provide: NitroService,
        useFactory: (opts: NitroModuleOptions, adapter: H3Adapter) => {
          return new NitroService(opts, null as any, null as any, adapter)
        },
        inject: [NITRO_OPTIONS, H3Adapter]
      }
    ]

    return {
      module: NitroModule,
      imports: options.imports || [],
      providers,
      exports: [NitroService, H3Adapter, NITRO_OPTIONS]
    }
  }

  /**
   * 功能模块注册
   * 用于在子模块中使用 Nitro 服务
   * 
   * @returns 动态模块
   * 
   * @example
   * ```typescript
   * @Module({
   *   imports: [NitroModule.forFeature()],
   *   controllers: [UserController],
   *   providers: [UserService]
   * })
   * export class UserModule {}
   * ```
   */
  static forFeature(): DynamicModule {
    return {
      module: NitroModule,
      exports: [NitroService, H3Adapter]
    }
  }

  /**
   * 创建异步提供者
   */
  private static createAsyncProviders(options: NitroModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)]
    }

    if (options.useClass) {
      return [
        this.createAsyncOptionsProvider(options),
        {
          provide: options.useClass,
          useClass: options.useClass
        }
      ]
    }

    return []
  }

  /**
   * 创建异步选项提供者
   */
  private static createAsyncOptionsProvider(options: NitroModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: NITRO_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || []
      }
    }

    if (options.useExisting) {
      return {
        provide: NITRO_OPTIONS,
        useFactory: async (optionsFactory: NitroOptionsFactory) =>
          await optionsFactory.createNitroOptions(),
        inject: [options.useExisting]
      }
    }

    if (options.useClass) {
      return {
        provide: NITRO_OPTIONS,
        useFactory: async (optionsFactory: NitroOptionsFactory) =>
          await optionsFactory.createNitroOptions(),
        inject: [options.useClass]
      }
    }

    throw new Error('Invalid NitroModuleAsyncOptions')
  }
}

/**
 * Nitro 核心模块
 * 不包含全局装饰器，适用于需要精确控制的场景
 */
@Module({})
export class NitroCoreModule {
  /**
   * 同步注册核心模块
   */
  static forRoot(options: NitroModuleOptions): DynamicModule {
    return {
      module: NitroCoreModule,
      providers: [
        {
          provide: NITRO_OPTIONS,
          useValue: options
        },
        H3Adapter,
        NitroService
      ],
      exports: [NitroService, H3Adapter, NITRO_OPTIONS]
    }
  }

  /**
   * 异步注册核心模块
   */
  static forRootAsync(options: NitroModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...NitroModule['createAsyncProviders'](options),
      H3Adapter,
      NitroService
    ]

    return {
      module: NitroCoreModule,
      imports: options.imports || [],
      providers,
      exports: [NitroService, H3Adapter, NITRO_OPTIONS]
    }
  }
}