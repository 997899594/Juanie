import { Module } from '@nestjs/common'
import { DrizzleModule } from '../../drizzle/drizzle.module'
import { HealthService } from './services/health.service'

@Module({
  imports: [DrizzleModule],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
