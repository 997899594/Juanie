/**
 * 🚀 Juanie AI - 主应用模块
 * 2025年最前沿的AI原生DevOps平台
 *
 * 集成所有前沿技术模块：
 * - AI智能体编排系统
 * - 零信任安全架构
 * - 性能优化和自动扩缩容
 * - 实时监控和智能告警
 * - WebAssembly微服务
 * - 边缘计算网格
 * - 量子安全加密
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
// 业务功能模块
import { AIModule } from "./ai/ai.module";
// 核心模块
import { CoreModule } from "./core/core.module";
import { MonitoringModule } from "./monitoring/monitoring.module";
import { PerformanceModule } from "./performance/performance.module";
import { SecurityModule } from "./security/security.module";

// tRPC 服务器
import { TRPCModule } from "./trpc/trpc.module";

@Module({
  imports: [
    // 全局配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      cache: true,
    }),

    // 核心基础设施模块
    CoreModule,

    // AI智能化模块
    AIModule,

    // 安全模块
    SecurityModule,

    // 监控模块
    MonitoringModule,

    // 性能优化模块
    PerformanceModule,

    // tRPC API模块
    TRPCModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
