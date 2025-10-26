import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntelligentAlertsService } from './intelligent-alerts.service';

@Module({
  imports: [DatabaseModule],
  providers: [IntelligentAlertsService],
  exports: [IntelligentAlertsService],
})
export class IntelligentAlertsModule {}