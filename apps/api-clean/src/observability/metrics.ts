import { metrics } from '@opentelemetry/api'

// 获取 Meter
const meter = metrics.getMeter('ai-devops-platform')

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

// 数据库查询指标
export const dbQueryCounter = meter.createCounter('db.queries.total', {
  description: 'Total number of database queries',
  unit: '1',
})

export const dbQueryDuration = meter.createHistogram('db.query.duration', {
  description: 'Database query duration in milliseconds',
  unit: 'ms',
})

export const dbConnectionPoolSize = meter.createUpDownCounter('db.connection_pool.size', {
  description: 'Current database connection pool size',
  unit: '1',
})

// 业务指标 - 部署
export const deploymentCounter = meter.createCounter('deployments.total', {
  description: 'Total number of deployments',
  unit: '1',
})

export const deploymentDuration = meter.createHistogram('deployment.duration', {
  description: 'Deployment duration in seconds',
  unit: 's',
})

export const deploymentStatusGauge = meter.createObservableGauge('deployments.status', {
  description: 'Current deployment status by environment',
  unit: '1',
})

// 业务指标 - Pipeline
export const pipelineRunCounter = meter.createCounter('pipeline_runs.total', {
  description: 'Total number of pipeline runs',
  unit: '1',
})

export const pipelineRunDuration = meter.createHistogram('pipeline_run.duration', {
  description: 'Pipeline run duration in seconds',
  unit: 's',
})

export const pipelineSuccessRate = meter.createObservableGauge('pipeline.success_rate', {
  description: 'Pipeline success rate percentage',
  unit: '%',
})

// 业务指标 - 用户活跃度
export const activeUsersGauge = meter.createObservableGauge('users.active', {
  description: 'Number of active users in the last 24 hours',
  unit: '1',
})

export const userSessionCounter = meter.createCounter('user.sessions.total', {
  description: 'Total number of user sessions created',
  unit: '1',
})

// 业务指标 - 组织和项目
export const organizationCounter = meter.createUpDownCounter('organizations.total', {
  description: 'Total number of organizations',
  unit: '1',
})

export const projectCounter = meter.createUpDownCounter('projects.total', {
  description: 'Total number of projects',
  unit: '1',
})

// 资源使用指标
export const storageUsageGauge = meter.createObservableGauge('storage.usage', {
  description: 'Storage usage in gigabytes',
  unit: 'GB',
})

export const computeUnitsGauge = meter.createObservableGauge('compute.units', {
  description: 'Compute units used',
  unit: '1',
})

// 成本指标
export const costGauge = meter.createObservableGauge('cost.monthly', {
  description: 'Monthly cost in USD',
  unit: 'USD',
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
 * 记录部署指标
 */
export function recordDeployment(
  environment: string,
  status: 'success' | 'failed' | 'cancelled',
  duration: number,
) {
  const attributes = {
    environment,
    status,
  }

  deploymentCounter.add(1, attributes)
  deploymentDuration.record(duration, attributes)
}

/**
 * 记录 Pipeline 运行指标
 */
export function recordPipelineRun(
  projectId: string,
  status: 'success' | 'failed' | 'cancelled',
  duration: number,
) {
  const attributes = {
    'project.id': projectId,
    status,
  }

  pipelineRunCounter.add(1, attributes)
  pipelineRunDuration.record(duration, attributes)
}

/**
 * 记录用户会话
 */
export function recordUserSession(userId: string) {
  userSessionCounter.add(1, {
    'user.id': userId,
  })
}

/**
 * 更新组织计数
 */
export function updateOrganizationCount(delta: number) {
  organizationCounter.add(delta)
}

/**
 * 更新项目计数
 */
export function updateProjectCount(delta: number) {
  projectCounter.add(delta)
}

/**
 * 更新数据库连接池大小
 */
export function updateDbConnectionPoolSize(size: number) {
  dbConnectionPoolSize.add(size)
}
