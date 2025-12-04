import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { TRPCError } from '@trpc/server'
import { getHTTPStatusCodeFromError } from '@trpc/server/http'
import { AppError } from '@juanie/types'

/**
 * 全局异常过滤器
 * 统一处理所有异常并返回标准格式
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest()

    // 记录错误日志
    this.logError(exception, request)

    // 处理不同类型的异常
    if (exception instanceof AppError) {
      return this.handleAppError(exception, response)
    }

    if (exception instanceof TRPCError) {
      return this.handleTRPCError(exception, response)
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, response)
    }

    // 处理未知错误
    return this.handleUnknownError(exception, response)
  }

  /**
   * 处理应用错误
   */
  private handleAppError(error: AppError, response: FastifyReply) {
    const statusCode = error.httpStatus || 500

    response.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp.toISOString(),
      },
    })
  }

  /**
   * 处理 tRPC 错误
   */
  private handleTRPCError(error: TRPCError, response: FastifyReply) {
    const statusCode = getHTTPStatusCodeFromError(error)

    response.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.cause,
        timestamp: new Date().toISOString(),
      },
    })
  }

  /**
   * 处理 HTTP 异常
   */
  private handleHttpException(error: HttpException, response: FastifyReply) {
    const statusCode = error.getStatus()
    const errorResponse = error.getResponse()

    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : (errorResponse as any).message || '请求处理失败'

    response.status(statusCode).send({
      success: false,
      error: {
        code: `HTTP_${statusCode}`,
        message,
        details: typeof errorResponse === 'object' ? errorResponse : undefined,
        timestamp: new Date().toISOString(),
      },
    })
  }

  /**
   * 处理未知错误
   */
  private handleUnknownError(error: unknown, response: FastifyReply) {
    const message = error instanceof Error ? error.message : '未知错误'

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: {
        code: 'SYSTEM_INTERNAL_ERROR',
        message: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? { originalMessage: message } : undefined,
        timestamp: new Date().toISOString(),
      },
    })
  }

  /**
   * 记录错误日志
   */
  private logError(exception: unknown, request: any) {
    const { method, url, ip, headers } = request

    const errorInfo = {
      method,
      url,
      ip,
      userAgent: headers['user-agent'],
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : String(exception),
    }

    // 根据错误类型决定日志级别
    if (exception instanceof AppError) {
      if (exception.httpStatus >= 500) {
        this.logger.error('应用错误', errorInfo)
      } else {
        this.logger.warn('应用错误', errorInfo)
      }
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus()
      if (status >= 500) {
        this.logger.error('HTTP 异常', errorInfo)
      } else {
        this.logger.warn('HTTP 异常', errorInfo)
      }
    } else {
      this.logger.error('未知错误', errorInfo)
    }
  }
}
