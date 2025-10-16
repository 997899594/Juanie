import {
  Module,
  Global,
} from '@nestjs/common'
import type {
  DynamicModule,
  Provider,
  Type
} from '@nestjs/common'
import { DrizzleService } from './drizzle.service.js'
import type { 
  DrizzleModuleOptions, 
  DrizzleModuleAsyncOptions, 
  DrizzleOptionsFactory,
  DrizzleMultiConnectionOptions 
} from './interfaces/drizzle-options.interface.js'
import { 
  DRIZZLE_OPTIONS, 
  DRIZZLE_CONNECTION, 
  DEFAULT_CONNECTION_NAME 
} from './constants/drizzle.constants.js'
import { getDrizzleConnectionToken } from './decorators/inject-drizzle.decorator.js'

@Global()
@Module({})
export class DrizzleModule {
  /**
   * 同步注册 Drizzle 模块
   */
  static forRoot(options: DrizzleModuleOptions): DynamicModule {
    const connectionName = options.name || DEFAULT_CONNECTION_NAME
    const connectionToken = getDrizzleConnectionToken(connectionName)

    const connectionProvider: Provider = {
      provide: connectionToken,
      useFactory: async (drizzleService: DrizzleService) => {
        const connectionInfo = await drizzleService.createConnection(connectionName, options)
        return connectionInfo.database
      },
      inject: [DrizzleService],
    }

    const optionsProvider: Provider = {
      provide: DRIZZLE_OPTIONS,
      useValue: options,
    }

    return {
      module: DrizzleModule,
      providers: [
        DrizzleService,
        optionsProvider,
        connectionProvider,
      ],
      exports: [
        DrizzleService,
        connectionToken,
      ],
      global: true,
    }
  }

  /**
   * 异步注册 Drizzle 模块
   */
  static forRootAsync(options: DrizzleModuleAsyncOptions): DynamicModule {
    const connectionName = options.name || DEFAULT_CONNECTION_NAME
    const connectionToken = getDrizzleConnectionToken(connectionName)

    const connectionProvider: Provider = {
      provide: connectionToken,
      useFactory: async (
        drizzleService: DrizzleService,
        moduleOptions: DrizzleModuleOptions
      ) => {
        const connectionInfo = await drizzleService.createConnection(connectionName, moduleOptions)
        return connectionInfo.database
      },
      inject: [DrizzleService, DRIZZLE_OPTIONS],
    }

    const asyncProviders = this.createAsyncProviders(options)

    return {
      module: DrizzleModule,
      imports: options.imports || [],
      providers: [
        DrizzleService,
        ...asyncProviders,
        connectionProvider,
      ],
      exports: [
        DrizzleService,
        connectionToken,
      ],
      global: options.isGlobal !== false,
    }
  }

  /**
   * 多连接注册
   */
  static forMultipleConnections(options: DrizzleMultiConnectionOptions): DynamicModule {
    const providers: Provider[] = [DrizzleService]
    const exports: (string | symbol | Type<any>)[] = [DrizzleService]

    // 为每个连接创建提供者
    for (const connectionConfig of options.connections) {
      const connectionToken = getDrizzleConnectionToken(connectionConfig.name)
      
      const connectionProvider: Provider = {
        provide: connectionToken,
        useFactory: async (drizzleService: DrizzleService) => {
          const connectionInfo = await drizzleService.createConnection(
            connectionConfig.name,
            connectionConfig
          )
          return connectionInfo.database
        },
        inject: [DrizzleService],
      }

      providers.push(connectionProvider)
      exports.push(connectionToken)
    }

    // 创建默认连接（如果指定）
    if (options.defaultConnection) {
      const defaultConnectionProvider: Provider = {
        provide: DRIZZLE_CONNECTION,
        useFactory: (drizzleService: DrizzleService) => {
          return drizzleService.getConnection(options.defaultConnection!)
        },
        inject: [DrizzleService],
      }

      providers.push(defaultConnectionProvider)
      exports.push(DRIZZLE_CONNECTION)
    }

    return {
      module: DrizzleModule,
      providers,
      exports,
      global: options.isGlobal !== false,
    }
  }

  /**
   * 功能模块注册（用于特定模块的 Drizzle 功能）
   */
  static forFeature(connectionName?: string): DynamicModule {
    const name = connectionName || DEFAULT_CONNECTION_NAME
    const connectionToken = getDrizzleConnectionToken(name)

    return {
      module: DrizzleFeatureModule,
      providers: [
        {
          provide: connectionToken,
          useFactory: (drizzleService: DrizzleService) => {
            return drizzleService.getConnection(name)
          },
          inject: [DrizzleService],
        },
      ],
      exports: [connectionToken],
    }
  }

  /**
   * 创建异步提供者
   */
  private static createAsyncProviders(options: DrizzleModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: DRIZZLE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ]
    }

    if (options.useClass) {
      return [
        {
          provide: DRIZZLE_OPTIONS,
          useFactory: async (optionsFactory: DrizzleOptionsFactory) => {
            return optionsFactory.createDrizzleOptions()
          },
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
          provide: DRIZZLE_OPTIONS,
          useFactory: async (optionsFactory: DrizzleOptionsFactory) => {
            return optionsFactory.createDrizzleOptions()
          },
          inject: [options.useExisting],
        },
      ]
    }

    throw new Error('Invalid async configuration')
  }
}

/**
 * Drizzle 功能模块
 */
@Module({})
export class DrizzleFeatureModule {}