import { Module } from '@nestjs/common';
import { PerformanceMetricsService } from './performance-metrics.service';
import { PerformanceMetricsRouter } from './performance-metrics.router';

@Module({
  providers: [PerformanceMetricsService, PerformanceMetricsRouter],
  exports: [PerformanceMetricsService],
})
export class PerformanceMetricsModule {}