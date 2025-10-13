import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { HealthService } from './services/health.service'

/**
 * 健康检查模块
 * 提供系统健康状态检查功能
 */
@Module({
  imports: [DatabaseModule],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
