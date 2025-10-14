import { TRPCError } from '@trpc/server'

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 'UNAUTHORIZED', 401)
  }

  static conflict(message = 'Conflict') {
    return new AppError(message, 'CONFLICT', 409)
  }

  static notFound(message = 'Not found') {
    return new AppError(message, 'NOT_FOUND', 404)
  }

  static internal(message = 'Internal server error', details?: Record<string, any>) {
    const err = new AppError(message, 'INTERNAL_ERROR', 500)
    // 轻量扩展：将 details 附加到 Error 对象上，便于格式化器读取
    ;(err as any).details = details
    return err
  }
}

export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof AppError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return new TRPCError({
          code: 'UNAUTHORIZED',
          message: error.message,
        })
      case 'FORBIDDEN':
        return new TRPCError({
          code: 'FORBIDDEN',
          message: error.message,
        })
      case 'NOT_FOUND':
        return new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
        })
      case 'BAD_REQUEST':
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        })
      case 'CONFLICT':
        return new TRPCError({
          code: 'CONFLICT',
          message: error.message,
        })
      default:
        return new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        })
    }
  }

  if (error instanceof Error) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
    })
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unknown error occurred',
  })
}

// 常用错误工厂函数
export const createUnauthorizedError = (message = 'Unauthorized') =>
  new AppError(message, 'UNAUTHORIZED', 401)

export const createForbiddenError = (message = 'Forbidden') =>
  new AppError(message, 'FORBIDDEN', 403)

export const createNotFoundError = (message = 'Not found') =>
  new AppError(message, 'NOT_FOUND', 404)

export const createBadRequestError = (message = 'Bad request') =>
  new AppError(message, 'BAD_REQUEST', 400)

export const createConflictError = (message = 'Conflict') => new AppError(message, 'CONFLICT', 409)
