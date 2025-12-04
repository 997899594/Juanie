import { DatabaseModule } from '@juanie/core/database'
import { QueueModule } from '@juanie/core/queue'
import { RBACModule } from '@juanie/core/rbac'
import { BusinessModule } from '@juanie/service-business'
import { ExtensionsModule } from '@juanie/service-extensions'
import { FoundationModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
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
    // Pino Logger（全局日志）
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                  singleLine: false,
                  // 美化应用日志
                  messageFormat: '{context} {msg}',
                },
              }
            : undefined,
        // 自定义日志格式
        customProps: (_req, _res) => ({
          context: 'HTTP',
        }),
        // 序列化配置
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              // 不记录完整的 headers（可能包含敏感信息）
            }
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            }
          },
        },
      },
    }),
    // Core modules
    DatabaseModule,
    QueueModule,
    RBACModule, // RBAC 权限系统（全局模块）
    // Three-tier service architecture
    FoundationModule, // 基础层
    BusinessModule, // 业务层（包含业务 Workers）
    ExtensionsModule, // 扩展层
    // API module
    TrpcModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
