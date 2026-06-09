import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getK8sClient, isK8sAvailable } from '@/lib/k8s';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';

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

  if (!isK8sAvailable()) {
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

export async function getHealthResponse() {
  const startTime = Date.now();
  const checks: HealthResponse['checks'] = {
    database: { status: 'pass' },
  };

  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  try {
    checks.database = await checkDatabase();
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    overallStatus = 'unhealthy';
  }

  if (isRedisConfigured()) {
    try {
      checks.redis = await checkRedis();
    } catch (error) {
      checks.redis = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
  }

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

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

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

  if (isRedisConfigured()) {
    try {
      response.checks.redis = await checkRedis();
    } catch (error) {
      response.status = 'degraded';
      response.checks.redis = {
        status: 'warn',
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
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
