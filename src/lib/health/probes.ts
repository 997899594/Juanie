import { NextResponse } from 'next/server';

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
