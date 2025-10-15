/* Nitro + tRPC + NestJS 架构入口文件
 *
 * 清晰的分层架构：
 * - Nitro (边缘/HTTP 适配层)：负责文件路由与浏览器交互
 * - tRPC (前端到后端的类型化 RPC)：面向 SPA 的业务接口
 * - NestJS (领域服务/DI 容器)：承载业务服务
 * - Drizzle (数据持久化)：ORM 层
 */
import "reflect-metadata";

import type { INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// NestJS 应用实例管理
let nestApp: INestApplicationContext | null = null;

export interface AppContainer {
  nestApp: INestApplicationContext;
}

// 创建 HTTP 服务器（用于独立运行）
export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  return app;
}

// 创建应用上下文（用于 Nitro 集成）
export async function initNestAppContainer(): Promise<AppContainer> {
  if (nestApp) {
    return { nestApp };
  }

  try {
    console.log("🚀 开始初始化 NestJS 应用上下文...");

    // 创建 NestJS 应用上下文
    nestApp = await NestFactory.createApplicationContext(AppModule, {
      logger: ["error", "warn", "log"],
    });

    // 启用关闭钩子
    nestApp.enableShutdownHooks();

    // 验证 ConfigService 是否正确初始化
    const configService = nestApp.get(ConfigService);
    if (!configService) {
      throw new Error("ConfigService not initialized");
    }

    console.log("✅ NestJS 应用上下文初始化成功");
    console.log("✅ ConfigService 初始化成功");

    // 初始化服务容器
    const { getServiceContainer } = await import("./lib/service-container");
    const serviceContainer = getServiceContainer();
    await serviceContainer.initialize(nestApp);

    return { nestApp };
  } catch (error) {
    console.error("❌ NestJS 应用初始化失败:", error);
    throw error;
  }
}

export async function getNestApp(): Promise<INestApplicationContext> {
  if (!nestApp) {
    const container = await initNestAppContainer();
    return container.nestApp;
  }
  return nestApp;
}

export async function getAppContainer(): Promise<AppContainer> {
  const nestApp = await getNestApp();
  return { nestApp };
}

// 优雅关闭
export async function closeNestApp(): Promise<void> {
  if (nestApp) {
    await nestApp.close();
    nestApp = null;
  }
}
// 导出
export { createContext } from "./lib/trpc/context";
export {
  protectedProcedure,
  publicProcedure,
  router,
} from "./lib/trpc/procedures";

// 类型定义
export * from "./lib/types/index";
// 工具
export { buildOpenApiDocument } from "./openapi";
// tRPC
export type { AppRouter } from "./routers/index";
