/**
 * 🚀 Juanie AI - 主应用模块
 * 2025年最前沿的AI原生DevOps平台
 *
 * 架构设计：
 * - App模块只负责全局配置和基础设施
 * - 业务模块通过TrpcModule统一管理
 * - 避免重复导入，保持架构清晰
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { TrpcModule } from "./trpc/trpc.module";

@Module({
  imports: [
    // 全局配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      cache: true,
    }),

    // 数据库模块 - 全局共享
    DatabaseModule,

    // tRPC API模块 - 包含所有业务模块
    TrpcModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
