import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { IntelligentAlertsService } from './intelligent-alerts.service';

@Module({
  imports: [DatabaseModule],
  providers: [IntelligentAlertsService, TrpcService],
  exports: [IntelligentAlertsService],
})
export class IntelligentAlertsModule {}