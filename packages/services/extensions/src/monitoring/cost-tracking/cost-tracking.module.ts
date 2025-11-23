import { Module } from '@nestjs/common'
import { CostTrackingService } from './cost-tracking.service'

@Module({
  providers: [CostTrackingService],
  exports: [CostTrackingService],
})
export class CostTrackingModule {}
