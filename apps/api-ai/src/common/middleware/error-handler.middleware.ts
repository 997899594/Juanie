import { 
  Injectable, 
  NestMiddleware, 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * 全局异常过滤器
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || message;
        error = responseObj.error || error;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      error = 'VALIDATION_ERROR';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = 'APPLICATION_ERROR';
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception
    );

    // 返回统一格式的错误响应
    response.status(status).json({
      success: false,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

/**
 * 错误处理中间件
 */
@Injectable()
export class ErrorHandlerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
    });

    // 捕获未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    next();
  }
}

/**
 * 错误处理工具类
 */
export class ErrorHandler {
  private static readonly logger = new Logger(ErrorHandler.name);

  /**
   * 包装异步函数，自动处理错误
   */
  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logger.error('Async function error:', error);
        throw error;
      }
    };
  }

  /**
   * 安全执行函数，返回结果或错误
   */
  static async safeExecute<T>(
    fn: () => Promise<T>
  ): Promise<{ success: true; data: T } | { success: false; error: Error }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      this.logger.error('Safe execution failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * 创建标准化错误
   */
  static createError(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: any
  ): HttpException {
    return new HttpException(
      {
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      statusCode
    );
  }

  /**
   * 验证并抛出错误
   */
  static validateAndThrow(condition: boolean, message: string, statusCode?: HttpStatus): void {
    if (!condition) {
      throw this.createError(message, statusCode);
    }
  }
}