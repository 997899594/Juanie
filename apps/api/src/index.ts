import { prometheus } from "@hono/prometheus";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { timing } from "hono/timing";
import pino from "pino";
import { env } from "./lib/env";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import authRoutes from "./routes/auth";

// 配置高性能日志
const pinoLogger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

const app = new Hono();

// Prometheus 监控中间件
const { printMetrics, registerMetrics } = prometheus();

// 基础中间件
app.use("*", timing());
app.use("*", registerMetrics);
app.use("*", logger());
app.use("*", compress());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  })
);

// 开发环境美化 JSON 输出
if (env.NODE_ENV === "development") {
  app.use("*", prettyJSON());
}

// 健康检查和监控端点
app.get("/health", (c) => {
  pinoLogger.info("Health check requested");
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/metrics", printMetrics);

app.get("/", (c) => {
  pinoLogger.info("Root endpoint accessed");
  return c.json({ message: "Modern API Server", version: "1.0.0" });
});

// OAuth 认证路由
app.route("/auth", authRoutes);

// tRPC 路由
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  })
);

const port = env.PORT;
const hostname = env.HOSTNAME;

pinoLogger.info(`🚀 Server starting on http://${hostname}:${port}`);

export default {
  port,
  hostname,
  fetch: app.fetch,
};
