/**
 * 🚀 Juanie AI - 主应用模块
 * 2025年最前沿的AI原生DevOps平台
 *
 * 集成所有前沿技术模块：
 * - AI智能体编排系统
 * - 零信任安全架构
 * - 性能优化和自动扩缩容
 * - 实时监控和智能告警
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { TrpcModule } from "./trpc/trpc.module";
import { UsersModule } from "./modules/users";
import { OrganizationsModule } from "./modules/organizations";

@Module({
  imports: [
    // 全局配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      cache: true,
    }),

    // 数据库模块
    DatabaseModule,

    // tRPC API模块
    TrpcModule,

    // 核心业务模块
    UsersModule,
    OrganizationsModule,
    // ProjectsModule,
    // TeamsModule,

    // 权限认证模块 (待实现)
    // AuthModule,
    // OAuthModule,

    // 代码管理模块 (待实现)
    // RepositoriesModule,
    // CodeAnalysisModule,

    // 部署运维模块 (待实现)
    // EnvironmentsModule,
    // DeploymentsModule,
    // MonitoringModule,

    // 事件处理模块 (待实现)
    // EventsModule,
    // IncidentsModule,

    // AI智能模块 (待实现)
    // AIModule,

    // 成本审计模块 (待实现)
    // CostModule,
    // AuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
