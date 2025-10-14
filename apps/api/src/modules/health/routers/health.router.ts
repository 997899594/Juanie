import { z } from "zod";
import { DrizzleService } from "../../../drizzle/drizzle.service";
import { publicProcedure, router } from "../../../lib/trpc/procedures";
import { getNestApp } from "../../../nest";

export const healthRouter = router({
  // 健康检查
  check: publicProcedure.query(async ({ ctx }) => {
    return await ctx.healthService.getHealthStatus();
  }),

  // 系统信息
  info: publicProcedure.query(() => ({
    name: "Juanie API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })),
});
