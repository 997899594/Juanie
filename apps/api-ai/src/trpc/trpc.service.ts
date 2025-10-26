/**
 * tRPC 服务 - 提供基础配置和中间件
 */

import { Injectable, Logger } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

export interface Context {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

@Injectable()
export class TrpcService {
  private readonly logger = new Logger(TrpcService.name);

  trpc = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => {
      // 增强错误格式化
      const formattedError = {
        ...shape,
        data: {
          ...shape.data,
          code: error.code,
          httpStatus: this.getHttpStatusFromTRPCCode(error.code),
          zodError: null as any,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      };

      // 处理 Zod 验证错误
      if (error.code === 'BAD_REQUEST' && error.cause instanceof ZodError) {
        formattedError.data.zodError = error.cause.flatten();
      }

      // 记录错误日志
      this.logger.error(`tRPC Error [${error.code}]: ${error.message}`, {
        code: error.code,
        cause: error.cause,
        stack: error.stack,
      });

      return formattedError;
    },
  });

  procedure = this.trpc.procedure;
  router = this.trpc.router;
  mergeRouters = this.trpc.mergeRouters;

  // 公开过程 - 不需要认证
  publicProcedure = this.trpc.procedure.use(async ({ next }) => {
    const start = Date.now();
    const result = await next();
    const duration = Date.now() - start;
    
    this.logger.debug(`Public procedure executed in ${duration}ms`);
    return result;
  });

  // 受保护过程 - 需要用户认证
  protectedProcedure = this.trpc.procedure.use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in to access this resource.',
      });
    }

    const start = Date.now();
    const result = await next({
      ctx: {
        user: ctx.user,
      },
    });
    const duration = Date.now() - start;
    
    this.logger.debug(`Protected procedure executed in ${duration}ms for user ${ctx.user.id}`);
    return result;
  });

  // 组织过程 - 需要用户认证且属于组织
  organizationProcedure = this.protectedProcedure.use(async ({ ctx, next }) => {
    if (!ctx.user.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Organization membership required. Please join an organization to access this resource.',
      });
    }

    const start = Date.now();
    const result = await next({
      ctx: {
        user: ctx.user,
      },
    });
    const duration = Date.now() - start;
    
    this.logger.debug(`Organization procedure executed in ${duration}ms for user ${ctx.user.id} in org ${ctx.user.organizationId}`);
    return result;
  });

  private getHttpStatusFromTRPCCode(code: string): number {
    switch (code) {
      case 'BAD_REQUEST':
        return 400;
      case 'UNAUTHORIZED':
        return 401;
      case 'FORBIDDEN':
        return 403;
      case 'NOT_FOUND':
        return 404;
      case 'METHOD_NOT_SUPPORTED':
        return 405;
      case 'TIMEOUT':
        return 408;
      case 'CONFLICT':
        return 409;
      case 'PRECONDITION_FAILED':
        return 412;
      case 'PAYLOAD_TOO_LARGE':
        return 413;
      case 'UNPROCESSABLE_CONTENT':
        return 422;
      case 'TOO_MANY_REQUESTS':
        return 429;
      case 'CLIENT_CLOSED_REQUEST':
        return 499;
      case 'INTERNAL_SERVER_ERROR':
      default:
        return 500;
    }
  }
}