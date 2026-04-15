import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getIsConnected, getK8sClient, initK8sClient } from '@/lib/k8s';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';

// ============================================
// Health Check Response
// ============================================

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
    redis?: HealthCheck;
    kubernetes?: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  latency?: number;
}

function createBaseResponse(): HealthResponse {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'pass' },
    },
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  await db.execute('SELECT 1');

  return {
    status: 'pass',
    latency: Date.now() - start,
  };
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  const redis = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    await redis.ping();

    return {
      status: 'pass',
      latency: Date.now() - start,
    };
  } finally {
    redis.disconnect();
  }
}

async function checkKubernetes(): Promise<HealthCheck> {
  const start = Date.now();
  initK8sClient();

  if (!getIsConnected()) {
    return {
      status: 'warn',
      message: 'Kubernetes client not available',
      latency: Date.now() - start,
    };
  }

  const { core } = getK8sClient();
  await core.listNamespace({ limit: 1 });

  return {
    status: 'pass',
    latency: Date.now() - start,
  };
}

function okJson(body: unknown, startTime?: number) {
  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...(typeof startTime === 'number'
        ? {
            'X-Health-Check-Latency': `${Date.now() - startTime}ms`,
          }
        : {}),
    },
  });
}

function failJson(body: unknown, startTime?: number) {
  return NextResponse.json(body, {
    status: 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...(typeof startTime === 'number'
        ? {
            'X-Health-Check-Latency': `${Date.now() - startTime}ms`,
          }
        : {}),
    },
  });
}

// ============================================
// Main Health Check
// GET /api/health
// ============================================

export async function GET() {
  const startTime = Date.now();
  const checks: HealthResponse['checks'] = {
    database: { status: 'pass' },
  };

  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  // 检查数据库连接
  try {
    checks.database = await checkDatabase();
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    overallStatus = 'unhealthy';
  }

  // 检查 Redis (可选)
  if (isRedisConfigured()) {
    try {
      checks.redis = await checkRedis();
    } catch (error) {
      checks.redis = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
      // Redis 失败不会导致整体不健康，只是降级
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
  }

  // 检查 Kubernetes (可选)
  const k8sEnabled =
    process.env.KUBECONFIG || process.env.KUBECONFIG_CONTENT || process.env.KUBERNETES_SERVICE_HOST;
  if (k8sEnabled) {
    try {
      checks.kubernetes = await checkKubernetes();
    } catch (error) {
      checks.kubernetes = {
        status: 'warn',
        message: error instanceof Error ? error.message : 'Kubernetes client not available',
      };
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check-Latency': `${Date.now() - startTime}ms`,
    },
  });
}

export async function getReadinessResponse() {
  const startTime = Date.now();
  const response = createBaseResponse();

  try {
    response.checks.database = await checkDatabase();
  } catch (error) {
    response.status = 'unhealthy';
    response.checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };

    return failJson(response, startTime);
  }

  return okJson(response, startTime);
}

export function getLivenessResponse() {
  return okJson({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
}

export function getStartupResponse() {
  return okJson({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
