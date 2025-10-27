import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

export interface Context {
  req: any;
  res: any;
  user?: any;
  organization?: any;
}

@Injectable()
export class TrpcService {
  private trpc = initTRPC.context<Context>().create();

  public router = this.trpc.router;
  public procedure = this.trpc.procedure;

  public publicProcedure = this.trpc.procedure;

  public protectedProcedure = this.trpc.procedure.use(async ({ ctx, next }) => {
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
  });

  public organizationProcedure = this.trpc.procedure.use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
    
    if (!ctx.organization) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Organization access required',
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        organization: ctx.organization,
      },
    });
  });

  public adminProcedure = this.trpc.procedure.use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!ctx.user.isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

  public createContext = ({ req, res }: { req: any; res: any }): Context => {
    return {
      req,
      res,
      user: req.user,
      organization: req.organization,
    };
  };
}
