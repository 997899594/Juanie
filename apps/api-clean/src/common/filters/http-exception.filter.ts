import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(typeof message === 'string' ? { message } : message),
    }

    // 记录错误日志
    if (status >= 500) {
      console.error('Server Error:', {
        ...errorResponse,
        stack: exception instanceof Error ? exception.stack : undefined,
      })
    }

    response.status(status).send(errorResponse)
  }
}
