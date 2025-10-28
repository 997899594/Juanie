import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';

export interface Context {
  req: any;
  res: any;
  user?: {
    id: string;
    email: string;
    isAdmin?: boolean;
  };
  organization?: {
    id: string;
    name: string;
  };
}

@Injectable()
export class TrpcService {
  private readonly trpc = initTRPC.context<Context>().create();

  // 私有方法：统一的鉴权检查
  private requireAuth = (ctx: Context) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
    return ctx.user;
  };

  private requireOrganization = (ctx: Context) => {
    if (!ctx.organization) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Organization access required',
      });
    }
    return ctx.organization;
  };

  private requireAdmin = (user: NonNullable<Context['user']>) => {
    if (!user.isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }
  };

  // 公共访问器
  public get router() {
    return this.trpc.router;
  }

  public get publicProcedure() {
    return this.trpc.procedure;
  }

  public get protectedProcedure() {
    return this.trpc.procedure.use(async ({ ctx, next }) => {
      const user = this.requireAuth(ctx);
      return next({ ctx: { ...ctx, user } });
    });
  }

  public get organizationProcedure() {
    return this.trpc.procedure.use(async ({ ctx, next }) => {
      const user = this.requireAuth(ctx);
      const organization = this.requireOrganization(ctx);
      return next({ ctx: { ...ctx, user, organization } });
    });
  }

  public get adminProcedure() {
    return this.trpc.procedure.use(async ({ ctx, next }) => {
      const user = this.requireAuth(ctx);
      this.requireAdmin(user);
      return next({ ctx: { ...ctx, user } });
    });
  }

  public createContext = ({ req, res }: { req: any; res: any }): Context => ({
    req,
    res,
    user: req.user,
    organization: req.organization,
  });
}
