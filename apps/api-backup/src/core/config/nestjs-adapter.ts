/**
 * NestJS 配置服务适配器 - 适配 Nitro 环境
 */

import { Injectable } from '@nestjs/common'
import type { Config } from './index'
import { getConfig } from './nitro'

@Injectable()
export class ConfigService {
  private readonly config: Config

  constructor() {
    this.config = getConfig()
  }

  /** 获取配置值 */
  get<T = any>(key: string, defaultValue?: T): T {
    const keys = key.split('.')
    let value: any = this.config

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue as T
      }
    }

    return value as T
  }

  /** 获取配置值（必须存在） */
  getOrThrow<T = any>(key: string): T {
    const value = this.get<T>(key)
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" is required but not found`)
    }
    return value
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
}
