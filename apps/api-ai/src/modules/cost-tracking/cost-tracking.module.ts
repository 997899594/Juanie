import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { CostTrackingService } from './cost-tracking.service';

@Module({
  imports: [DatabaseModule],
  providers: [CostTrackingService, TrpcService],
  exports: [CostTrackingService],
})
export class CostTrackingModule {}