/**
 * NestJS 配置模块 - 为 NestJS 应用提供配置服务
 */

import { Global, Injectable, Module } from '@nestjs/common'
import {
  ConfigModule as NestConfigModule,
  ConfigService as NestConfigService,
} from '@nestjs/config'
import { type Config, ConfigError } from './index'
import { loadConfig } from './loader'

// ============================================================================
// NestJS 配置服务
// ============================================================================

@Injectable()
export class ConfigService {
  private readonly config: Config

  constructor() {
    try {
      this.config = loadConfig()
    } catch (error) {
      throw new ConfigError(
        `Failed to initialize ConfigService: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /** 获取完整配置 */
  getConfig(): Config {
    return this.config
  }

  /** 获取应用配置 */
  getApp(): Config['app'] {
    return this.config.app
  }

  /** 获取数据库配置 */
  getDatabase(): Config['database'] {
    return this.config.database
  }

  /** 获取 Redis 配置 */
  getRedis(): Config['redis'] {
    return this.config.redis
  }

  /** 获取 OAuth 配置 */
  getOAuth(): Config['oauth'] {
    return this.config.oauth
  }

  /** 获取安全配置 */
  getSecurity(): Config['security'] {
    return this.config.security
  }

  /** 获取监控配置 */
  getMonitoring(): Config['monitoring'] {
    return this.config.monitoring
  }

  /** 获取嵌套配置值 */
  get<T = any>(path: string): T | undefined {
    const keys = path.split('.')
    let current: any = this.config

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined
      }
      current = current[key]
    }

    return current
  }

  /** 获取嵌套配置值（带默认值） */
  getOrThrow<T = any>(path: string): T {
    const value = this.get<T>(path)
    if (value === undefined) {
      throw new ConfigError(`Configuration value not found: ${path}`)
    }
    return value
  }

  /** 检查配置路径是否存在 */
  has(path: string): boolean {
    return this.get(path) !== undefined
  }

  /** 获取环境 */
  getEnvironment(): Config['app']['environment'] {
    return this.config.app.environment
  }

  /** 检查是否为开发环境 */
  isDevelopment(): boolean {
    return this.config.app.environment === 'development'
  }

  /** 检查是否为生产环境 */
  isProduction(): boolean {
    return this.config.app.environment === 'production'
  }

  /** 检查是否为测试环境 */
  isTest(): boolean {
    return this.config.app.environment === 'test'
  }

  /** 检查是否启用调试 */
  isDebug(): boolean {
    return this.config.app.debug
  }
}

// ============================================================================
// 配置工厂函数
// ============================================================================

/** 配置工厂函数 - 用于 NestJS ConfigModule */
export function configFactory(): Config {
  return loadConfig()
}

/** 应用配置工厂 */
export function appConfigFactory(): Config['app'] {
  return loadConfig().app
}

/** 数据库配置工厂 */
export function databaseConfigFactory(): Config['database'] {
  return loadConfig().database
}

/** Redis 配置工厂 */
export function redisConfigFactory() {
  const config = loadConfig()
  return config.redis || {}
}

/** OAuth 配置工厂 */
export function oauthConfigFactory(): Config['oauth'] {
  return loadConfig().oauth
}

/** 安全配置工厂 */
export function securityConfigFactory(): Config['security'] {
  return loadConfig().security
}

/** 监控配置工厂 */
export function monitoringConfigFactory(): Config['monitoring'] {
  return loadConfig().monitoring
}

// ============================================================================
// NestJS 配置模块
// ============================================================================

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [
        configFactory,
        appConfigFactory,
        databaseConfigFactory,
        redisConfigFactory,
        oauthConfigFactory,
        securityConfigFactory,
        monitoringConfigFactory,
      ],
      isGlobal: true,
      cache: true,
      expandVariables: false, // 我们自己处理环境变量
    }),
  ],
  providers: [ConfigService, NestConfigService],
  exports: [ConfigService, NestConfigService],
})
export class ConfigModule {}

// ============================================================================
// 类型导出
// ============================================================================

export type { Config } from './index'

// ============================================================================
// 便捷导出
// ============================================================================

export { ConfigError, ConfigValidationError } from './index'
