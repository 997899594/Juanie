import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DrizzleModule } from './drizzle/drizzle.module.js'
import { HealthService } from './services/health.service.js'
import { TrpcService } from './trpc/trpc.service.js'
import { DatabaseService } from './services/database.service.js'
import { AuthService } from './services/auth.service.js'

/**
 * 应用主模块
 * 配置所有服务和模块的依赖关系
 * 建立清晰的服务层次结构
 */
@Module({
  imports: [
    // 全局配置模块，加载环境变量
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Drizzle ORM 模块
    DrizzleModule,
  ],
  providers: [
    // 核心服务层
    HealthService,
    DatabaseService,
    AuthService,
    
    // tRPC 服务层
    TrpcService,
  ],
  exports: [
    // 导出服务供其他模块使用
    HealthService,
    DatabaseService,
    AuthService,
    TrpcService,
  ],
})
export class AppModule {}
