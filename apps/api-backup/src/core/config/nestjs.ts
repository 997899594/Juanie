/**
 * 简化的配置服务 - 移除 NestJS 依赖
 */

import { Injectable } from '@nestjs/common'
import { type Config, ConfigError } from './index'
import { loadConfig } from './loader'

// ============================================================================
// 简化的配置服务
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

  /** 获取配置值 */
  get<T = any>(path: string): T | undefined {
    try {
      return path.split('.').reduce((obj, key) => obj?.[key], this.config as any)
    } catch {
      return undefined
    }
  }

  /** 获取配置值或抛出错误 */
  getOrThrow<T = any>(path: string): T {
    const value = this.get<T>(path)
    if (value === undefined) {
      throw new ConfigError(`Configuration path "${path}" not found`)
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

  /** 是否为开发环境 */
  isDevelopment(): boolean {
    return this.config.app.environment === 'development'
  }

  /** 是否为生产环境 */
  isProduction(): boolean {
    return this.config.app.environment === 'production'
  }

  /** 是否为测试环境 */
  isTest(): boolean {
    return this.config.app.environment === 'test'
  }

  /** 是否启用调试 */
  isDebug(): boolean {
    return this.config.app.debug
  }
}

// 导出类型
export type { Config } from './index'
export { ConfigError, ConfigValidationError } from './index'
