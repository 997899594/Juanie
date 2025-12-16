import { DatabaseModule } from '@juanie/core/database'
import { QueueModule } from '@juanie/core/queue'
import { RBACModule } from '@juanie/core/rbac'
import { BusinessModule } from '@juanie/service-business'
import { ExtensionsModule } from '@juanie/service-extensions'
import { FoundationModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import pretty from 'pino-pretty'
import { AppController } from './app.controller'
import { TrpcModule } from './trpc/trpc.module'

// 开发环境使用同步 stream（兼容 Bun，避免 worker threads）
const isDev = process.env.NODE_ENV !== 'production'
const prettyStream = isDev
  ? pretty({
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname,context', // 忽略 context（已在 messageFormat 中显示）
      singleLine: true,
      messageFormat: (log: Record<string, unknown>, messageKey: string) => {
        const ctx = log.context || 'App'
        const msg = log[messageKey] || ''
        return `[${ctx}] ${msg}`
      },
    })
  : undefined

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
    // traceId/spanId 由 @opentelemetry/instrumentation-pino 自动注入
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        // 开发环境使用同步 pretty stream（兼容 Bun）
        ...(isDev ? { stream: prettyStream } : {}),
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
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
