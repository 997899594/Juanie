/**
 * 统一日志服务
 *
 * 基于 nestjs-pino，通过依赖注入使用
 * traceId/spanId 由 @opentelemetry/instrumentation-pino 自动注入
 */
export { PinoLogger, PinoLogger as Logger, PinoLogger as LoggerService } from 'nestjs-pino'
