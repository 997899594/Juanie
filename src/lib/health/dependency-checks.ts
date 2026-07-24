import { NextResponse } from 'next/server';
import { resolveKubernetesConfiguration } from '@/lib/k8s/configuration';

type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  checks: {
    applicationDelivery?: HealthCheck;
    deliveryControlPlane?: HealthCheck;
    database: HealthCheck;
    redis?: HealthCheck;
    kubernetes?: HealthCheck;
    restate?: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn' | 'not_applicable';
  message?: string;
  latency?: number;
}

export function createKubernetesNotApplicableCheck(): HealthCheck {
  return {
    status: 'not_applicable',
    message: 'Kubernetes access is not assigned to this runtime',
  };
}

export function deriveFullHealthStatus(checks: HealthResponse['checks']): HealthStatus {
  const requiredChecks = [
    checks.database,
    checks.restate,
    checks.applicationDelivery,
    checks.deliveryControlPlane,
  ];
  if (requiredChecks.some((check) => check?.status === 'fail')) return 'unhealthy';

  if (Object.values(checks).some((check) => check?.status === 'fail' || check?.status === 'warn')) {
    return 'degraded';
  }

  return 'healthy';
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
  const { db } = await import('@/lib/db');
  await db.execute('SELECT 1');

  return {
    status: 'pass',
    latency: Date.now() - start,
  };
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  const { createRedisClient } = await import('@/lib/redis/config');
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

async function checkRestateServiceCatalog(): Promise<HealthCheck> {
  const start = Date.now();
  const adminUrl = process.env.RESTATE_ADMIN_URL ?? 'http://localhost:9070';
  const { verifyRestateServiceCatalog } = await import('@/lib/restate/service-catalog');
  const catalog = await verifyRestateServiceCatalog(adminUrl);
  return {
    status: 'pass',
    message: `${catalog.expectedServiceCount} required services registered`,
    latency: Date.now() - start,
  };
}

async function checkKubernetes(): Promise<HealthCheck> {
  const start = Date.now();
  const { getK8sClient, isK8sAvailable } = await import('@/lib/k8s');

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

async function checkApplicationDelivery(): Promise<HealthCheck> {
  const start = Date.now();
  const { verifyApplicationDeliveryCapability } = await import('@/lib/ci/application-delivery');
  const capability = await verifyApplicationDeliveryCapability();
  return {
    status: 'pass',
    message: `${capability.repository}:${capability.workflow}`,
    latency: Date.now() - start,
  };
}

async function checkDeliveryChain(): Promise<HealthCheck> {
  const { checkDeliveryControlPlane } = await import('@/lib/health/delivery-control-plane');
  return checkDeliveryControlPlane();
}

async function isRedisConfigured(): Promise<boolean> {
  const redisConfig = await import('@/lib/redis/config');
  return redisConfig.isRedisConfigured();
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

  try {
    checks.database = await checkDatabase();
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }

  if (await isRedisConfigured()) {
    try {
      checks.redis = await checkRedis();
    } catch (error) {
      checks.redis = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  try {
    checks.restate = await checkRestateServiceCatalog();
  } catch (error) {
    checks.restate = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Restate connection failed',
    };
  }

  if (resolveKubernetesConfiguration()) {
    try {
      checks.kubernetes = await checkKubernetes();
    } catch (error) {
      checks.kubernetes = {
        status: 'warn',
        message: error instanceof Error ? error.message : 'Kubernetes client not available',
      };
    }
  } else {
    checks.kubernetes = createKubernetesNotApplicableCheck();
  }

  try {
    checks.applicationDelivery = await checkApplicationDelivery();
  } catch (error) {
    checks.applicationDelivery = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Application delivery is unavailable',
    };
  }

  try {
    checks.deliveryControlPlane = await checkDeliveryChain();
  } catch (error) {
    checks.deliveryControlPlane = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Delivery control-plane check failed',
    };
  }

  const overallStatus = deriveFullHealthStatus(checks);

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  };

  return NextResponse.json(response, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
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

  if (await isRedisConfigured()) {
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

  try {
    response.checks.restate = await checkRestateServiceCatalog();
  } catch (error) {
    response.status = 'unhealthy';
    response.checks.restate = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Restate connection failed',
    };
    return failJson(response, startTime);
  }

  return okJson(response, startTime);
}
