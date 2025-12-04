/**
 * 日志工具函数
 *
 * 提供统一的日志格式化和错误处理
 */

/**
 * 格式化错误对象为可读字符串
 *
 * @param error - 错误对象
 * @returns 格式化的错误字符串
 */
export function formatError(error: any): string {
  if (!error) {
    return 'Unknown error'
  }

  if (error instanceof Error) {
    return `${error.message} (${error.name})`
  }

  if (typeof error === 'object') {
    // 尝试提取常见的错误字段
    if (error.message) {
      return error.message
    }
    if (error.error) {
      return formatError(error.error)
    }
    // 最后尝试 JSON 序列化
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

/**
 * 提取错误详情
 *
 * @param error - 错误对象
 * @returns 结构化的错误详情
 */
export function extractErrorDetails(error: any): {
  message: string
  stack?: string
  code?: string
  statusCode?: number
  name?: string
  [key: string]: any
} {
  if (!error) {
    return {
      message: 'Unknown error',
    }
  }

  const details: any = {
    message: error.message || String(error),
  }

  // 错误名称
  if (error.name) {
    details.name = error.name
  }

  // 堆栈追踪（仅在开发环境）
  if (process.env.NODE_ENV === 'development' && error.stack) {
    details.stack = error.stack
  }

  // 错误代码
  if (error.code) {
    details.code = error.code
  }

  // HTTP 状态码
  if (error.statusCode || error.status) {
    details.statusCode = error.statusCode || error.status
  }

  // 响应数据（API 错误）
  if (error.response) {
    details.response = {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
    }
  }

  // 请求信息（API 错误）
  if (error.config) {
    details.request = {
      method: error.config.method,
      url: error.config.url,
    }
  }

  return details
}

/**
 * 创建结构化日志上下文
 *
 * @param data - 上下文数据
 * @returns JSON 字符串
 */
export function createLogContext(data: Record<string, any>): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch (error) {
    return String(data)
  }
}

/**
 * 脱敏敏感信息
 *
 * @param data - 原始数据
 * @returns 脱敏后的数据
 */
export function sanitizeSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sensitiveKeys = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'privateKey',
    'authorization',
    'cookie',
    'session',
  ]

  const sanitized = Array.isArray(data) ? [...data] : { ...data }

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase()

    // 检查是否是敏感字段
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '***REDACTED***'
      continue
    }

    // 递归处理嵌套对象
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeSensitiveData(sanitized[key])
    }
  }

  return sanitized
}

/**
 * 格式化持续时间
 *
 * @param ms - 毫秒数
 * @returns 可读的持续时间字符串
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/**
 * 创建性能日志
 *
 * @param operation - 操作名称
 * @param startTime - 开始时间（毫秒）
 * @param metadata - 额外的元数据
 * @returns 日志对象
 */
export function createPerformanceLog(
  operation: string,
  startTime: number,
  metadata?: Record<string, any>,
) {
  const duration = Date.now() - startTime

  return {
    msg: operation,
    duration,
    durationFormatted: formatDuration(duration),
    ...metadata,
  }
}

/**
 * 限制数组长度（用于日志）
 *
 * @param array - 原始数组
 * @param maxLength - 最大长度
 * @returns 截断后的数组和省略信息
 */
export function limitArrayForLog<T>(
  array: T[],
  maxLength: number = 10,
): {
  items: T[]
  total: number
  truncated: boolean
} {
  return {
    items: array.slice(0, maxLength),
    total: array.length,
    truncated: array.length > maxLength,
  }
}

/**
 * 获取当前 trace ID（如果有）
 *
 * @returns trace ID 或 undefined
 */
export function getCurrentTraceId(): string | undefined {
  try {
    // 尝试从 OpenTelemetry 获取
    const { trace } = require('@opentelemetry/api')
    const span = trace.getActiveSpan()
    return span?.spanContext().traceId
  } catch {
    return undefined
  }
}

/**
 * 创建带 trace ID 的日志对象
 *
 * @param msg - 日志消息
 * @param metadata - 元数据
 * @returns 日志对象
 */
export function createTracedLog(msg: string, metadata?: Record<string, any>) {
  const traceId = getCurrentTraceId()

  return {
    msg,
    ...(traceId && { traceId }),
    ...metadata,
  }
}
