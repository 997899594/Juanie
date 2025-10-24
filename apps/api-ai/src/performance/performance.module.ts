/**
 * 🚀 Juanie AI - 性能优化模块
 * 整合性能监控、自动扩缩容和智能优化服务
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// 性能服务
import {
  PerformanceService,
  PerformanceCollector,
  PerformanceAnalyzer,
  AutoOptimizer,
} from './performance.service';

// 自动扩缩容服务
import {
  AutoScalerService,
  MetricsCollector,
  PredictionEngine,
  ScalingExecutor,
} from './autoscaler.service';

// 控制器
import { PerformanceController } from './performance.controller';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    PerformanceController,
  ],
  providers: [
    // 性能监控服务
    PerformanceCollector,
    PerformanceAnalyzer,
    AutoOptimizer,
    PerformanceService,
    
    // 自动扩缩容服务
    MetricsCollector,
    PredictionEngine,
    ScalingExecutor,
    AutoScalerService,
  ],
  exports: [
    PerformanceService,
    AutoScalerService,
  ],
})
export class PerformanceModule {}