import { initTRPC } from "@trpc/server";
import type { Request, Response } from "express";

export interface Context {
  req: Request;
  res: Response;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
