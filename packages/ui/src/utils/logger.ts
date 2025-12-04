/**
 * 前端 Logger 工具
 *
 * 统一的日志管理，支持：
 * - 开发/生产环境区分
 * - 日志级别控制
 * - 结构化日志
 * - 错误上报（可扩展）
 */

// 扩展全局 ImportMeta 类型以支持 Vite 环境变量
declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean
    readonly PROD: boolean
    readonly VITE_LOG_LEVEL?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  level: LogLevel
  enabled: boolean
  enableConsole: boolean
  enableRemote: boolean
}

class Logger {
  private config: LoggerConfig

  constructor() {
    this.config = {
      level: this.getLogLevel(),
      enabled: true,
      enableConsole: import.meta.env.DEV,
      enableRemote: import.meta.env.PROD,
    }
  }

  private getLogLevel(): LogLevel {
    const level = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined
    return level || (import.meta.env.DEV ? 'debug' : 'info')
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)

    return messageLevelIndex >= currentLevelIndex
  }

  private logToConsole(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (!this.config.enableConsole) return

    const style = this.getConsoleStyle(level)

    switch (level) {
      case 'debug':
        console.debug(`%c[${level.toUpperCase()}]`, style, message, context || '')
        break
      case 'info':
        console.info(`%c[${level.toUpperCase()}]`, style, message, context || '')
        break
      case 'warn':
        console.warn(`%c[${level.toUpperCase()}]`, style, message, context || '')
        break
      case 'error':
        console.error(`%c[${level.toUpperCase()}]`, style, message, context || '')
        break
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #6B7280; font-weight: bold',
      info: 'color: #3B82F6; font-weight: bold',
      warn: 'color: #F59E0B; font-weight: bold',
      error: 'color: #EF4444; font-weight: bold',
    }
    return styles[level]
  }

  private async logToRemote(
    _level: LogLevel,
    _message: string,
    _context?: Record<string, unknown>,
  ) {
    if (!this.config.enableRemote) return
    if (_level !== 'error' && _level !== 'warn') return

    // TODO: 实现远程日志上报
    // 可以集成 Sentry、LogRocket 等服务
    try {
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(this.formatMessage(level, message, context)),
      // })
    } catch (_error) {
      // 静默失败，避免日志上报影响用户体验
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('debug')) return
    this.logToConsole('debug', message, context)
  }

  /**
   * 信息日志
   */
  info(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('info')) return
    this.logToConsole('info', message, context)
  }

  /**
   * 警告日志
   */
  warn(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('warn')) return
    this.logToConsole('warn', message, context)
    this.logToRemote('warn', message, context)
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    if (!this.shouldLog('error')) return

    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    }

    this.logToConsole('error', message, errorContext)
    this.logToRemote('error', message, errorContext)
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel) {
    this.config.level = level
  }

  /**
   * 启用/禁用日志
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled
  }
}

// 导出单例
export const logger = new Logger()

// 导出便捷方法
export const log = {
  debug: (message: string, context?: Record<string, unknown>) => logger.debug(message, context),
  info: (message: string, context?: Record<string, unknown>) => logger.info(message, context),
  warn: (message: string, context?: Record<string, unknown>) => logger.warn(message, context),
  error: (message: string, error?: Error | unknown, context?: Record<string, unknown>) =>
    logger.error(message, error, context),
}
