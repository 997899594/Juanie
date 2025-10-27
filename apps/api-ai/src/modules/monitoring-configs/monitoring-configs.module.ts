import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { MonitoringConfigsService } from './monitoring-configs.service';
import { MonitoringConfigsRouter } from './monitoring-configs.router';

@Module({
  providers: [MonitoringConfigsService, MonitoringConfigsRouter, TrpcService],
  exports: [MonitoringConfigsService],
})
export class MonitoringConfigsModule {}