/**
 * 统一日志系统
 *
 * 基于 nestjs-pino，通过依赖注入使用
 * traceId/spanId 由 @opentelemetry/instrumentation-pino 自动注入
 *
 * 使用方式：
 * import { Logger } from '@juanie/core/logger'
 * constructor(private readonly logger: Logger) {
 *   this.logger.setContext(MyService.name)
 * }
 */
export { Logger, LoggerService } from './logger.service'
