import { TRPCError } from '@trpc/server'

/**
 * 错误类型枚举
 */
export enum ErrorCode {
  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // 数据相关
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // 系统相关
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // 业务相关
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>,
  ) {
    super(message)

    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational
    // 只有当 context 存在时才赋值
    if (context !== undefined) {
      this.context = context
    }

    // 确保堆栈跟踪正确
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 错误处理工具类
 */
// 替换原先的静态类 ErrorHandler 为常量对象 + 函数实现
function mapErrorCodeToTRPC(code: ErrorCode): TRPCError['code'] {
  const mapping: Record<ErrorCode, TRPCError['code']> = {
    [ErrorCode.UNAUTHORIZED]: 'UNAUTHORIZED',
    [ErrorCode.FORBIDDEN]: 'FORBIDDEN',
    [ErrorCode.TOKEN_EXPIRED]: 'UNAUTHORIZED',
    [ErrorCode.NOT_FOUND]: 'NOT_FOUND',
    [ErrorCode.CONFLICT]: 'CONFLICT',
    [ErrorCode.VALIDATION_ERROR]: 'BAD_REQUEST',
    [ErrorCode.INTERNAL_ERROR]: 'INTERNAL_SERVER_ERROR',
    [ErrorCode.DATABASE_ERROR]: 'INTERNAL_SERVER_ERROR',
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'INTERNAL_SERVER_ERROR',
    [ErrorCode.BUSINESS_LOGIC_ERROR]: 'BAD_REQUEST',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'TOO_MANY_REQUESTS',
  }
  return mapping[code] || 'INTERNAL_SERVER_ERROR'
}

function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error
  }
  if (error instanceof AppError) {
    return new TRPCError({
      code: mapErrorCodeToTRPC(error.code),
      message: error.message,
      cause: error,
    })
  }
  if (error instanceof Error) {
    if (error.message.includes('database') || error.message.includes('connection')) {
      return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '数据库连接错误',
        cause: error,
      })
    }
    if (error.message.includes('jwt') || error.message.includes('token')) {
      return new TRPCError({
        code: 'UNAUTHORIZED',
        message: '认证令牌无效',
        cause: error,
      })
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return new TRPCError({
        code: 'BAD_REQUEST',
        message: error.message,
        cause: error,
      })
    }
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误',
    cause: error,
  })
}

function logError(error: unknown, context?: Record<string, any>) {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  }
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Error occurred:', errorInfo)
  } else {
    console.error(JSON.stringify(errorInfo))
  }
}

function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational
  }
  if (error instanceof TRPCError) {
    return ['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT'].includes(
      error.code,
    )
  }
  return false
}

export const ErrorHandler = {
  toTRPCError,
  mapErrorCodeToTRPC,
  logError,
  isOperationalError,
} as const

/**
 * 常用错误创建函数
 */
export const createError = {
  unauthorized: (message = '未授权访问') => new AppError(message, ErrorCode.UNAUTHORIZED, 401),

  forbidden: (message = '禁止访问') => new AppError(message, ErrorCode.FORBIDDEN, 403),

  notFound: (resource = '资源') => new AppError(`${resource}不存在`, ErrorCode.NOT_FOUND, 404),

  conflict: (message = '资源冲突') => new AppError(message, ErrorCode.CONFLICT, 409),

  validation: (message = '数据验证失败') => new AppError(message, ErrorCode.VALIDATION_ERROR, 400),

  database: (message = '数据库操作失败') => new AppError(message, ErrorCode.DATABASE_ERROR, 500),

  internal: (message = '服务器内部错误') => new AppError(message, ErrorCode.INTERNAL_ERROR, 500),

  rateLimit: (message = '请求频率超限') =>
    new AppError(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429),
}
