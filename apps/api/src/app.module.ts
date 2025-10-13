import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './modules/auth/auth.module'
import { DatabaseModule } from './modules/database/database.module'
import { GitModule } from './modules/git/git.module'
import { HealthModule } from './modules/health/health.module'
import { TrpcService } from './trpc/trpc.service'

/**
 * 应用根模块
 * 整合所有功能模块
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    GitModule,
    HealthModule,
  ],
  providers: [TrpcService],
})
export class AppModule {}
