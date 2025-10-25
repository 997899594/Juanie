/**
 * tRPC 服务 - 提供基础配置和中间件
 */

import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';

export interface Context {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

@Injectable()
export class TrpcService {
  trpc = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    }),
  });

  procedure = this.trpc.procedure;
  router = this.trpc.router;
  middleware = this.trpc.middleware;

  // 公开访问的过程
  publicProcedure = this.procedure;

  // 需要认证的过程
  protectedProcedure = this.procedure.use(
    this.middleware(async ({ ctx, next }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );

  // 需要组织权限的过程
  organizationProcedure = this.protectedProcedure.use(
    this.middleware(async ({ ctx, next }) => {
      if (!ctx.user?.organizationId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Organization membership required',
        });
      }
      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
}