import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AiModule } from './ai/ai.module'
import { AuditModule } from './audit/audit.module'
import { HealthController } from './common/health/health.controller'
import { RedisModule } from './common/redis/redis.module'
import { KubernetesModule } from './kubernetes/kubernetes.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule,
    AiModule,
    KubernetesModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
