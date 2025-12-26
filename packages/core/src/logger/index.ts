/**
 * 统一日志系统
 *
 * 直接使用 nestjs-pino，通过依赖注入使用
 * traceId/spanId 由 @opentelemetry/instrumentation-pino 自动注入
 *
 * 使用方式：
 * import { PinoLogger } from 'nestjs-pino'
 * constructor(private readonly logger: PinoLogger) {
 *   this.logger.setContext(MyService.name)
 * }
 */

// 直接使用 nestjs-pino，不再提供封装
// import { PinoLogger } from 'nestjs-pino'
