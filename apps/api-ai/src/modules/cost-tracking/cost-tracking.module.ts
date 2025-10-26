import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CostTrackingService } from './cost-tracking.service';

@Module({
  imports: [DatabaseModule],
  providers: [CostTrackingService],
  exports: [CostTrackingService],
})
export class CostTrackingModule {}