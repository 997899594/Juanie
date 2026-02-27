/**
 * 健康检查端点
 *
 * GET /api/health - 主健康检查
 * GET /api/health/ready - 就绪检查
 * GET /api/health/live - 存活检查
 * GET /api/health/startup - 启动检查
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getIsConnected, initK8sClient } from '@/lib/k8s';

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
    const start = Date.now();
    await db.execute('SELECT 1');
    checks.database = {
      status: 'pass',
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    overallStatus = 'unhealthy';
  }

  // 检查 Redis (可选)
  const redisEnabled = process.env.REDIS_HOST || process.env.REDIS_URL;
  if (redisEnabled) {
    try {
      const start = Date.now();
      // 简单的 PING 检查
      // TODO: 实现实际的 Redis 检查
      checks.redis = {
        status: 'pass',
        latency: Date.now() - start,
      };
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
  const k8sEnabled = process.env.KUBECONFIG || process.env.KUBECONFIG_CONTENT;
  if (k8sEnabled) {
    try {
      const start = Date.now();
      initK8sClient();
      const connected = getIsConnected();
      checks.kubernetes = {
        status: connected ? 'pass' : 'warn',
        latency: Date.now() - start,
      };
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
