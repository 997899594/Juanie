/* Nitro + tRPC + NestJS 架构入口文件
 *
 * 清晰的分层架构：
 * - Nitro (边缘/HTTP 适配层)：负责文件路由与浏览器交互
 * - tRPC (前端到后端的类型化 RPC)：面向 SPA 的业务接口
 * - NestJS (领域服务/DI 容器)：承载业务服务
 * - Drizzle (数据持久化)：ORM 层
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  return app;
}
export { createContext } from "./lib/trpc/context";
export {
  protectedProcedure,
  publicProcedure,
  router,
} from "./lib/trpc/procedures";

// 类型定义
export * from "./lib/types";
export type { AppContainer } from "./nest";
export { getAppContainer, initNestAppContainer } from "./nest";
// 工具
export { buildOpenApiDocument } from "./openapi";
// tRPC
export type { AppRouter } from "./routers/index";