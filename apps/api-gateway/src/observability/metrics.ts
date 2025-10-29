import { metrics } from '@opentelemetry/api'

// 获取 Meter
const meter = metrics.getMeter('api-gateway')

// HTTP 请求指标
export const httpRequestCounter = meter.createCounter('http.requests.total', {
  description: 'Total number of HTTP requests',
  unit: '1',
})

export const httpRequestDuration = meter.createHistogram('http.request.duration', {
  description: 'HTTP request duration in milliseconds',
  unit: 'ms',
})

export const httpRequestErrors = meter.createCounter('http.requests.errors', {
  description: 'Total number of HTTP request errors',
  unit: '1',
})

// tRPC 请求指标
export const trpcRequestCounter = meter.createCounter('trpc.requests.total', {
  description: 'Total number of tRPC requests',
  unit: '1',
})

export const trpcRequestDuration = meter.createHistogram('trpc.request.duration', {
  description: 'tRPC request duration in milliseconds',
  unit: 'ms',
})

export const trpcRequestErrors = meter.createCounter('trpc.requests.errors', {
  description: 'Total number of tRPC request errors',
  unit: '1',
})

// 数据库查询指标
export const dbQueryCounter = meter.createCounter('db.queries.total', {
  description: 'Total number of database queries',
  unit: '1',
})

export const dbQueryDuration = meter.createHistogram('db.query.duration', {
  description: 'Database query duration in milliseconds',
  unit: 'ms',
})

// 用户会话指标
export const userSessionCounter = meter.createCounter('user.sessions.total', {
  description: 'Total number of user sessions created',
  unit: '1',
})

/**
 * 记录 HTTP 请求指标
 */
export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
) {
  const attributes = {
    'http.method': method,
    'http.route': path,
    'http.status_code': statusCode,
  }

  httpRequestCounter.add(1, attributes)
  httpRequestDuration.record(duration, attributes)

  if (statusCode >= 400) {
    httpRequestErrors.add(1, attributes)
  }
}

/**
 * 记录 tRPC 请求指标
 */
export function recordTrpcRequest(
  procedure: string,
  type: 'query' | 'mutation' | 'subscription',
  success: boolean,
  duration: number,
) {
  const attributes = {
    'trpc.procedure': procedure,
    'trpc.type': type,
    'trpc.success': success,
  }

  trpcRequestCounter.add(1, attributes)
  trpcRequestDuration.record(duration, attributes)

  if (!success) {
    trpcRequestErrors.add(1, attributes)
  }
}

/**
 * 记录数据库查询指标
 */
export function recordDbQuery(operation: string, table: string, duration: number) {
  const attributes = {
    'db.operation': operation,
    'db.table': table,
  }

  dbQueryCounter.add(1, attributes)
  dbQueryDuration.record(duration, attributes)
}

/**
 * 记录用户会话
 */
export function recordUserSession(userId: string) {
  userSessionCounter.add(1, {
    'user.id': userId,
  })
}
