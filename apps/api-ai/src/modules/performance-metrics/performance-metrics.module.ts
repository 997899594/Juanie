import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { PerformanceMetricsService } from './performance-metrics.service';
import { PerformanceMetricsRouter } from './performance-metrics.router';

@Module({
  providers: [PerformanceMetricsService, PerformanceMetricsRouter, TrpcService],
  exports: [PerformanceMetricsService, PerformanceMetricsRouter],
})
export class PerformanceMetricsModule {}