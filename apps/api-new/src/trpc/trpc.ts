import { initTRPC } from "@trpc/server";
import type { Request, Response } from "express";

export interface Context {
  req: Request;
  res: Response;
  session?: {
    userId: string;
    sessionId: string;
  };
}

const t = initTRPC.context<Context>().create();

export const createTRPCRouter = t.router;
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.userId) {
    throw new Error('Unauthorized');
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
