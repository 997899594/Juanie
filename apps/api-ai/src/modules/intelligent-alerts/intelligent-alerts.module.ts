import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { IntelligentAlertsService } from './intelligent-alerts.service';
import { IntelligentAlertsRouter } from './intelligent-alerts.router';

@Module({
  imports: [DatabaseModule],
  providers: [IntelligentAlertsService, IntelligentAlertsRouter, TrpcService],
  exports: [IntelligentAlertsService, IntelligentAlertsRouter],
})
export class IntelligentAlertsModule {}