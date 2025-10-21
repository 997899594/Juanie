import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TRPCError } from '@trpc/server';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    traceId?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let code: string;
    let message: string;
    let details: any;

    // 处理不同类型的异常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        code = responseObj.error || exception.constructor.name;
        message = responseObj.message || exception.message;
        details = responseObj.details;
      } else {
        code = exception.constructor.name;
        message = exception.message;
      }
    } else if (exception instanceof TRPCError) {
      // 处理 tRPC 错误
      status = this.mapTRPCErrorToHttpStatus(exception.code);
      code = exception.code;
      message = exception.message;
      details = exception.cause;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = exception.message || 'Internal server error';
      details = process.env.NODE_ENV === 'development' ? exception.stack : undefined;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'UNKNOWN_ERROR';
      message = 'An unknown error occurred';
    }

    // 生成追踪ID
    const traceId = this.generateTraceId();

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        traceId,
      },
    };

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} ${code}: ${message}`,
      {
        traceId,
        method: request.method,
        url: request.url,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
        exception: exception instanceof Error ? exception.stack : exception,
      }
    );

    response.status(status).json(errorResponse);
  }

  private mapTRPCErrorToHttpStatus(code: string): number {
    const statusMap: Record<string, number> = {
      BAD_REQUEST: HttpStatus.BAD_REQUEST,
      UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
      FORBIDDEN: HttpStatus.FORBIDDEN,
      NOT_FOUND: HttpStatus.NOT_FOUND,
      METHOD_NOT_SUPPORTED: HttpStatus.METHOD_NOT_ALLOWED,
      TIMEOUT: HttpStatus.REQUEST_TIMEOUT,
      CONFLICT: HttpStatus.CONFLICT,
      PRECONDITION_FAILED: HttpStatus.PRECONDITION_FAILED,
      PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
      UNPROCESSABLE_CONTENT: HttpStatus.UNPROCESSABLE_ENTITY,
      TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
      CLIENT_CLOSED_REQUEST: HttpStatus.BAD_REQUEST,
      INTERNAL_SERVER_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
    };

    return statusMap[code] || HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}