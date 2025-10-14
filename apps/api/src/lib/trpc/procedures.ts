import { initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import { AppError, toTRPCError } from "../errors";
import type { TRPCContext } from "./context";
import type { TRPCMeta } from "./meta";

const t = initTRPC
  .context<TRPCContext>()
  .meta<TRPCMeta>()
  .create({
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

// 基础中间件
const errorHandlerMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    throw toTRPCError(error);
  }
});

// 认证中间件
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw AppError.unauthorized("Authentication required");
  }
  return next({ ctx: { ...ctx, user: ctx.user! } });
});

// 导出路由器和过程
export const router = t.router;
export const publicProcedure = t.procedure.use(errorHandlerMiddleware);
export const protectedProcedure = publicProcedure.use(authMiddleware);
