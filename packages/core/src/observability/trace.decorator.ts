import { SpanStatusCode, trace } from '@opentelemetry/api'

/**
 * @Trace 装饰器 - 自动为服务方法创建追踪 Span
 *
 * 使用 OpenTelemetry 自动追踪服务方法的执行
 * - 自动记录方法参数（非敏感数据）
 * - 自动记录执行状态（成功/失败）
 * - 自动记录异常信息
 *
 * @param spanName - 可选的 Span 名称，默认使用 ClassName.methodName
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ProjectsService {
 *   @Trace()
 *   async createProject(input: CreateProjectInput) {
 *     // 自动追踪
 *   }
 *
 *   @Trace('projects.custom-operation')
 *   async customOperation() {
 *     // 使用自定义 span 名称
 *   }
 * }
 * ```
 */
export function Trace(spanName?: string) {
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    const tracer = trace.getTracer('juanie-platform')

    descriptor.value = async function (...args: unknown[]) {
      const name =
        spanName ||
        `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`

      return await tracer.startActiveSpan(name, async (span) => {
        try {
          // 添加方法参数作为属性（如果不是敏感数据）
          if (args.length > 0 && args.length <= 3) {
            args.forEach((arg, index) => {
              if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
                // 只记录简单对象的键
                span.setAttribute(
                  `arg${index}.keys`,
                  Object.keys(arg as Record<string, unknown>).join(','),
                )
              } else if (typeof arg === 'string' || typeof arg === 'number') {
                span.setAttribute(`arg${index}`, String(arg))
              }
            })
          }

          const result = await originalMethod.apply(this, args)
          span.setStatus({ code: SpanStatusCode.OK })
          return result
        } catch (error) {
          // 记录错误信息
          span.recordException(error as Error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message || 'Unknown error',
          })

          // 添加错误属性
          span.setAttribute(
            'error.type',
            (error as { constructor: { name: string } }).constructor.name,
          )
          if ((error as Error).stack) {
            span.setAttribute('error.stack', (error as Error).stack!)
          }

          throw error
        } finally {
          span.end()
        }
      })
    }

    return descriptor
  }
}
