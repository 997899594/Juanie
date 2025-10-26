import { Module } from '@nestjs/common';
import { MonitoringConfigsService } from './monitoring-configs.service';
import { MonitoringConfigsRouter } from './monitoring-configs.router';

@Module({
  providers: [MonitoringConfigsService, MonitoringConfigsRouter],
  exports: [MonitoringConfigsService],
})
export class MonitoringConfigsModule {}