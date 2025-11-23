import { DatabaseModule } from '@juanie/core-database/module'
import { QueueModule } from '@juanie/core-queue/module'
import { BusinessModule } from '@juanie/service-business'
import { ExtensionsModule } from '@juanie/service-extensions'
import { FoundationModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { TrpcModule } from './trpc/trpc.module'

/**
 * App Module - 应用主模块
 * 
 * 三层服务架构：
 * - Foundation（基础层）：认证、用户、组织、团队、存储
 * - Business（业务层）：项目、部署、GitOps
 * - Extensions（扩展层）：AI、监控、通知、安全
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '../../.env'],
    }),
    // Core modules
    DatabaseModule,
    QueueModule,
    // Three-tier service architecture
    FoundationModule, // 基础层
    BusinessModule, // 业务层
    ExtensionsModule, // 扩展层
    // API module
    TrpcModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
