import { Injectable } from '@nestjs/common'

@Injectable()
export class MetricsService {
  /**
   * Record a metric
   * TODO: Implement Prometheus metrics (Task 14.1)
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    console.log(`📊 Metric: ${name} = ${value}`, labels)
    // Placeholder - will be implemented in Task 14.1
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    this.recordMetric(name, 1, labels)
  }
}
