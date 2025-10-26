/**
 * 全局异常过滤器 - 统一错误处理
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponse;

    // 处理不同类型的异常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      errorResponse = {
        success: false,
        error: {
          code: exception.constructor.name,
          message: typeof exceptionResponse === 'string' 
            ? exceptionResponse 
            : (exceptionResponse as any).message || exception.message,
          details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    } else if (exception instanceof TRPCError) {
      // tRPC 错误处理
      status = this.getTRPCHttpStatus(exception.code);
      errorResponse = {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.cause,
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    } else if (exception instanceof ZodError) {
      // Zod 验证错误
      status = HttpStatus.BAD_REQUEST;
      errorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: exception.flatten(),
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    } else {
      // 未知错误
      this.logger.error('Unhandled exception:', exception);
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.error.message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }

  private getTRPCHttpStatus(code: string): number {
    switch (code) {
      case 'BAD_REQUEST':
        return HttpStatus.BAD_REQUEST;
      case 'UNAUTHORIZED':
        return HttpStatus.UNAUTHORIZED;
      case 'FORBIDDEN':
        return HttpStatus.FORBIDDEN;
      case 'NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'METHOD_NOT_SUPPORTED':
        return HttpStatus.METHOD_NOT_ALLOWED;
      case 'TIMEOUT':
        return HttpStatus.REQUEST_TIMEOUT;
      case 'CONFLICT':
        return HttpStatus.CONFLICT;
      case 'PRECONDITION_FAILED':
        return HttpStatus.PRECONDITION_FAILED;
      case 'PAYLOAD_TOO_LARGE':
        return HttpStatus.PAYLOAD_TOO_LARGE;
      case 'UNPROCESSABLE_CONTENT':
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case 'TOO_MANY_REQUESTS':
        return HttpStatus.TOO_MANY_REQUESTS;
      case 'CLIENT_CLOSED_REQUEST':
        return HttpStatus.BAD_REQUEST;
      case 'INTERNAL_SERVER_ERROR':
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}