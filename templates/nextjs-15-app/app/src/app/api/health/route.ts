import { NextResponse } from 'next/server'

{
  -
  if
  .enableDatabase
}

import { db } from '@/lib/db'

{
  ;-end
}
{
  -
  if
  .enableCache
}

import { redis } from '@/lib/redis'

{
  ;-end
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: {} as Record<string, { status: string; latency?: number }>,
  }
  -
  if
  .enableDatabase
  // Database health check
  try {
    const start = Date.now()
    await db.execute('SELECT 1')
    checks.checks.database = {
      status: 'healthy',
      latency: Date.now() - start,
    }
  } catch (error) {
    checks.status = 'unhealthy'
    checks.checks.database = { status: 'unhealthy' }
  }
  ;-end
  -
  if
  .enableCache
  // Redis health check
  try {
    const start = Date.now()
    await redis.ping()
    checks.checks.redis = {
      status: 'healthy',
      latency: Date.now() - start,
    }
  } catch (error) {
    checks.status = 'degraded'
    checks.checks.redis = { status: 'unhealthy' }
  }
  ;-end

  const statusCode = checks.status === 'healthy' ? 200 : 503

  return NextResponse.json(checks, { status: statusCode })
}
