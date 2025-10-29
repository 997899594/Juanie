import { Module } from '@nestjs/common'
import { CostTrackingRouter } from './cost-tracking.router'
import { CostTrackingService } from './cost-tracking.service'

@Module({
  providers: [CostTrackingService, CostTrackingRouter],
  exports: [CostTrackingService],
})
export class CostTrackingModule {}
