import { context, SpanStatusCode, trace } from '@opentelemetry/api'

/**
 * @Trace 装饰器 - 自动为服务方法创建追踪 Span
 *
 * @param spanName - 可选的 Span 名称，默认使用 ClassName.methodName
 *
 * @example
 * ```typescript
 * class MyService {
 *   @Trace()
 *   async myMethod() {
 *     // 自动追踪
 *   }
 *
 *   @Trace('custom-span-name')
 *   async anotherMethod() {
 *     // 使用自定义 Span 名称
 *   }
 * }
 * ```
 */
export function Trace(spanName?: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    const tracer = trace.getTracer('ai-devops-platform')

    descriptor.value = async function (...args: any[]) {
      const name = spanName || `${target.constructor.name}.${propertyKey}`

      return await tracer.startActiveSpan(name, async (span) => {
        try {
          // 添加方法参数作为属性（如果不是敏感数据）
          if (args.length > 0 && args.length <= 3) {
            args.forEach((arg, index) => {
              if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
                // 只记录简单对象的键
                span.setAttribute(`arg${index}.keys`, Object.keys(arg).join(','))
              } else if (typeof arg === 'string' || typeof arg === 'number') {
                span.setAttribute(`arg${index}`, String(arg))
              }
            })
          }

          const result = await originalMethod.apply(this, args)
          span.setStatus({ code: SpanStatusCode.OK })
          return result
        } catch (error: any) {
          // 记录错误信息
          span.recordException(error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message || 'Unknown error',
          })

          // 添加错误属性
          span.setAttribute('error.type', error.constructor.name)
          if (error.stack) {
            span.setAttribute('error.stack', error.stack)
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

/**
 * 手动创建 Span 的辅助函数
 *
 * @example
 * ```typescript
 * await withSpan('my-operation', async (span) => {
 *   span.setAttribute('custom.attribute', 'value')
 *   // 执行操作
 * })
 * ```
 */
export async function withSpan<T>(
  name: string,
  fn: (span: any) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = trace.getTracer('ai-devops-platform')

  return await tracer.startActiveSpan(name, async (span) => {
    try {
      // 添加自定义属性
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value)
        })
      }

      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error: any) {
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message || 'Unknown error',
      })
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * 获取当前追踪上下文信息
 */
export function getCurrentTraceContext() {
  const span = trace.getActiveSpan()
  if (!span) {
    return null
  }

  const spanContext = span.spanContext()
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  }
}

/**
 * 在当前 Span 中添加事件
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

/**
 * 在当前 Span 中添加属性
 */
export function setSpanAttribute(key: string, value: string | number | boolean) {
  const span = trace.getActiveSpan()
  if (span) {
    span.setAttribute(key, value)
  }
}
