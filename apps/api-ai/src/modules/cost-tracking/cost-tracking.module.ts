import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { CostTrackingService } from './cost-tracking.service';
import { CostTrackingRouter } from './cost-tracking.router';

@Module({
  imports: [DatabaseModule],
  providers: [CostTrackingService, CostTrackingRouter, TrpcService],
  exports: [CostTrackingService, CostTrackingRouter],
})
export class CostTrackingModule {}